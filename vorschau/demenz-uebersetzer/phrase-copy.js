// Satz-Seiten: „Kopieren“ neben jedem Satz, damit man ihn direkt per Nachricht weitergeben kann.
// Kein Eingabetext, keine Speicherung; Analytics (nur nach Einwilligung) erfährt nur den festen Situations-Schlüssel.
(() => {
  const lists = document.querySelectorAll('.phrase-list[data-copy-key]');
  if (!lists.length || !navigator.clipboard) return;
  lists.forEach((list) => {
    const key = list.getAttribute('data-copy-key');
    list.querySelectorAll('p').forEach((paragraph) => {
      const text = paragraph.textContent.trim().replace(/^„/, '').replace(/“$/, '');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'translator-copy phrase-copy';
      button.textContent = 'Kopieren';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = 'Kopiert ✓';
          if (typeof websiteAnalytics !== 'undefined') websiteAnalytics.track('translator_copy', { result_key: key, source: 'phrase_page' });
        } catch {
          button.textContent = 'Bitte markieren';
        }
        setTimeout(() => { button.textContent = 'Kopieren'; }, 1800);
      });
      paragraph.append(' ', button);
    });
  });
})();
