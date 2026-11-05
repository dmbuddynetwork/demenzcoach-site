// Gesprächstrainer: Quiz mit festen Antworten. Nichts wird gespeichert oder
// gesendet; Analytics (nach Einwilligung) erhält nur Frage-Schlüssel und Punktzahl.
(() => {
  const root = document.getElementById('trainer');
  const dataElement = document.getElementById('trainer-data');
  if (!root || !dataElement) return;
  const { questions: allQuestions, url } = JSON.parse(dataElement.textContent);
  const shortLength = 5;
  // Kommt man von einer Satz-Seite (#frage-<key>), startet der Trainer mit genau dieser Situation.
  const startKey = decodeURIComponent(location.hash.replace(/^#frage-/, ''));
  const startIndex = location.hash.startsWith('#frage-') ? allQuestions.findIndex((question) => question.key === startKey) : -1;
  if (startIndex > 0) allQuestions.unshift(...allQuestions.splice(startIndex, 1));
  let questions = allQuestions;
  // Nach dem Sprung von einer Satz-Seite: nach der ersten Frage frei wählen lassen, ob weiter geübt wird.
  const jumpedIn = startIndex >= 0;
  const appURL = 'https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=seo_de_trainer&mt=8';
  let index = 0;
  let score = 0;
  const missed = [];

  const track = (name, parameters) => {
    if (typeof websiteAnalytics !== 'undefined') websiteAnalytics.track(name, parameters);
  };

  const element = (tag, options = {}, children = []) => {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text) node.textContent = options.text;
    Object.entries(options.attributes ?? {}).forEach(([name, value]) => node.setAttribute(name, value));
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  };

  const focusHeading = () => root.querySelector('h2')?.focus({ preventScroll: false });

  const renderQuestion = () => {
    const question = questions[index];
    const progress = element('div', { className: 'trainer-progress', attributes: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(questions.length), 'aria-valuenow': String(index) } }, [
      element('span', { attributes: { style: `width:${(index / questions.length) * 100}%` } })
    ]);
    const options = element('div', { className: 'trainer-options', attributes: { role: 'group', 'aria-label': 'Antwortmöglichkeiten' } });
    const feedback = element('div', { className: 'trainer-feedback', attributes: { 'aria-live': 'polite' } });

    question.options.forEach((option) => {
      const button = element('button', { className: 'trainer-option', text: option.text, attributes: { type: 'button' } });
      button.addEventListener('click', () => {
        options.querySelectorAll('button').forEach((candidate, candidateIndex) => {
          candidate.disabled = true;
          if (question.options[candidateIndex].good) candidate.classList.add('is-good');
        });
        if (!option.good) button.classList.add('is-bad');
        if (option.good) score += 1;
        else missed.push(question);
        track('trainer_answer', { question_key: question.key, correct: option.good ? 'yes' : 'no' });

        const goodOption = question.options.find((candidate) => candidate.good);
        const offerReturn = jumpedIn && index === 0 && question.href;
        feedback.replaceChildren(...[
          element('p', { className: option.good ? 'trainer-verdict is-good' : 'trainer-verdict is-bad', text: option.good ? 'Gut gewählt.' : 'Eher ungünstig.' }),
          element('p', { text: option.why }),
          option.good ? null : element('p', { className: 'trainer-better-title', text: 'Besser:' }),
          option.good ? null : element('div', { className: 'translator-phrase' }, [element('q', { text: goodOption.text.replace(/^„|“$/g, '') })]),
          // Nur wer von einer Satz-Seite kam, bekommt den Weg zurück; sonst bleibt der Blick beim Üben.
          offerReturn ? element('p', { className: 'trainer-more' }, [
            element('a', { className: 'text-link', text: offerReturn ? 'Zurück zu den Sätzen →' : 'Mehr Sätze für diese Situation →', attributes: { href: question.href, 'data-related-link': question.key } })
          ]) : null
        ].filter(Boolean));
        const next = element('button', {
          className: 'button',
          text: index + 1 < questions.length ? (offerReturn ? `Weiter üben: ${questions.length - 1} weitere Situationen` : 'Nächste Situation') : 'Ergebnis ansehen',
          attributes: { type: 'button' }
        });
        next.addEventListener('click', () => {
          index += 1;
          if (index < questions.length) renderQuestion();
          else renderResult();
        });
        feedback.append(next);
        // Die Rückmeldung von oben zeigen (Urteil zuerst), nicht nur den Knopf am Ende.
        next.focus({ preventScroll: true });
        feedback.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
      options.append(button);
    });

    root.replaceChildren(
      progress,
      element('p', { className: 'eyebrow', text: `Situation ${index + 1} von ${questions.length}` }),
      element('h2', { className: 'trainer-situation', text: question.situation, attributes: { tabindex: '-1' } }),
      element('p', { className: 'trainer-ask', text: 'Was würdest du sagen?' }),
      options,
      feedback
    );
    if (index > 0) focusHeading();
  };

  const verdict = () => {
    const ratio = score / questions.length;
    if (ratio >= 0.85) return 'Du hast ein sehr gutes Gespür für ruhige, wertschätzende Antworten.';
    if (ratio >= 0.5) return 'Du liegst oft richtig. Ein paar Situationen lohnen sich, noch einmal anzuschauen.';
    return 'Viele dieser Reaktionen sind ganz normal – sie fallen uns zuerst ein. Gut, dass du es hier geübt hast.';
  };

  const renderResult = () => {
    track('trainer_complete', { score, total: questions.length });
    const shareText = `Ich habe beim Demenz-Gesprächstrainer ${score} von ${questions.length} Situationen ruhig gelöst. Wie würdest du antworten?`;
    // Ein einziger, klar beschrifteter Teilen-Knopf.
    let share;
    if (navigator.share) {
      share = element('button', { className: 'translator-copy', text: 'Ergebnis teilen', attributes: { type: 'button' } });
      share.addEventListener('click', async () => {
        try {
          await navigator.share({ title: 'Gesprächstrainer Demenz', text: shareText, url });
          track('trainer_share', { method: 'native', score });
        } catch {
          // Abgebrochen.
        }
      });
    } else {
      share = element('a', {
        className: 'translator-copy',
        text: 'Per WhatsApp teilen',
        attributes: { href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`, rel: 'noopener', target: '_blank' }
      });
      share.addEventListener('click', () => track('trainer_share', { method: 'whatsapp', score }));
    }

    const remaining = allQuestions.slice(questions.length);
    const continueButton = questions.length < allQuestions.length && questions[0] === allQuestions[0]
      ? element('button', { className: 'button', text: `Weitere ${remaining.length} Situationen üben`, attributes: { type: 'button' } })
      : null;
    continueButton?.addEventListener('click', () => {
      track('trainer_start', { length: 'rest' });
      begin(remaining);
    });
    const restart = element('button', { className: 'translator-copy', text: 'Noch einmal üben', attributes: { type: 'button' } });
    restart.addEventListener('click', () => {
      index = 0;
      score = 0;
      missed.length = 0;
      renderQuestion();
      focusHeading();
    });

    const review = missed.filter((question) => question.href);
    const reviewRest = review.filter((question) => question !== (missed[0] ?? questions[0])).slice(0, 3);
    // Ein Satz zum Mitnehmen: aus der ersten verpassten Situation, sonst aus der ersten geübten.
    const takeawayQuestion = missed[0] ?? questions[0];
    const takeawayText = takeawayQuestion.options.find((option) => option.good).text.replace(/^„|“$/g, '');
    const copyTakeaway = element('button', { className: 'translator-copy', text: 'Kopieren', attributes: { type: 'button' } });
    copyTakeaway.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(takeawayText);
        copyTakeaway.textContent = 'Kopiert';
        track('trainer_takeaway_copy', { question_key: takeawayQuestion.key });
      } catch {
        copyTakeaway.textContent = 'Bitte markieren und kopieren';
      }
    });
    const takeaway = element('div', { className: 'trainer-takeaway' }, [
      element('p', { className: 'trainer-takeaway-title', text: 'Ein Satz zum Mitnehmen' }),
      element('div', { className: 'translator-phrase' }, [element('q', { text: takeawayText }), copyTakeaway])
    ]);
    root.replaceChildren(...[
      element('h2', { className: 'trainer-score', text: `${score} von ${questions.length} Situationen ruhig gelöst`, attributes: { tabindex: '-1' } }),
      element('p', { text: verdict() }),
      takeaway,
      element('div', { className: 'translator-result-links' }, [continueButton, restart, share].filter(Boolean)),
      reviewRest.length ? element('p', { className: 'trainer-review-title', text: 'Weitere gute Sätze:' }) : null,
      reviewRest.length ? element('ul', {}, reviewRest.map((question) => element('li', {}, [
        element('a', { text: question.options.find((option) => option.good).text.replace(/^„|“$/g, ''), attributes: { href: question.href, 'data-related-link': question.key } })
      ]))) : null,
      element('aside', { className: 'article-cta translator-app-cta' }, [
        element('div', {}, [
          element('h2', { text: 'Jeden Tag kurz üben – mit der App' }),
          element('p', { text: 'Kostenlos laden. Abo nur, wenn du willst.' })
        ]),
        element('a', { className: 'button', text: 'Kostenlos im App Store', attributes: { href: appURL, 'data-store-link': 'trainer-result' } })
      ])
    ].filter(Boolean));
    focusHeading();
  };

  const begin = (selection) => {
    questions = selection;
    index = 0;
    score = 0;
    missed.length = 0;
    renderQuestion();
    focusHeading();
    // Auf dem Handy die erste Situation samt Antworten in den Blick holen.
    root.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  // Ohne Sprung von einer Satz-Seite: erst die Länge wählen lassen.
  const renderStart = () => {
    const short = element('button', { className: 'button', text: `Kurzrunde: ${shortLength} Situationen`, attributes: { type: 'button' } });
    const all = element('button', { className: 'button button-light-outline trainer-all', text: `Alle ${allQuestions.length} Situationen`, attributes: { type: 'button' } });
    short.addEventListener('click', () => {
      track('trainer_start', { length: 'kurz' });
      begin(allQuestions.slice(0, shortLength));
    });
    all.addEventListener('click', () => {
      track('trainer_start', { length: 'alle' });
      begin(allQuestions);
    });
    root.replaceChildren(
      element('p', { className: 'eyebrow', text: 'Los geht’s' }),
      element('h2', { className: 'trainer-situation', text: 'Wie viel möchtest du heute üben?', attributes: { tabindex: '-1' } }),
      element('p', { className: 'trainer-ask', text: 'Du kannst nach der Kurzrunde jederzeit weitermachen.' }),
      element('div', { className: 'translator-result-links trainer-start-choice' }, [short, all])
    );
  };

  if (jumpedIn || allQuestions.length <= shortLength) renderQuestion();
  else renderStart();
})();
