(() => {
  const toggle = document.querySelector('#lessonArchiveToggle');
  const panel = document.querySelector('#lessonArchivePanel');
  const countLabel = document.querySelector('#lessonArchiveCount');
  if (!toggle || !panel || !countLabel) return;

  let lessons = [];
  let loaded = false;
  const esc = value => escapeHTML(String(value ?? ''));
  const dateLabel = date => {
    if (!date) return '';
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, day)));
  };
  const safeLink = source => {
    if (!/^https:\/\//.test(source.url || '')) return '';
    return `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a>`;
  };
  const itemMarkup = item => {
    const blocks = [
      ['Original answer', item.original, 'original'],
      ['Correction', item.correction, 'correction'],
      ['Natural alternative', item.alternative, 'alternative']
    ].filter(([, value]) => value);
    return `<article class="archive-answer">${item.prompt ? `<h4 class="archive-answer-title">${esc(item.prompt)}</h4>` : ''}<div class="archive-answer-grid">${blocks.map(([label, text, cls]) => `<div class="archive-text-box ${cls}"><b>${esc(label)}</b><p>${esc(text)}</p></div>`).join('')}</div>${item.note ? `<p class="archive-note">${esc(item.note)}</p>` : ''}</article>`;
  };
  const lessonMarkup = lesson => {
    const focus = (lesson.focus || []).map(tag => `<span class="archive-tag">${esc(tag)}</span>`).join('');
    const grammar = lesson.grammar ? `<div class="archive-grammar"><b>${esc(lesson.grammar.pattern)}</b> — ${esc(lesson.grammar.explanation)}${(lesson.grammar.sources || []).map(safeLink).join('')}</div>` : '';
    const activities = (lesson.activities || []).map(activity => `<section class="archive-activity"><h3>${esc(activity.title)}</h3>${(activity.items || []).map(itemMarkup).join('')}</section>`).join('');
    return `<details class="archive-card" data-lesson-search="${esc([lesson.title, lesson.book, ...(lesson.focus || []), lesson.summary].join(' ').toLowerCase())}"><summary><span><span class="archive-title">${esc(lesson.title)}</span><span class="archive-meta">${esc(lesson.book)} · Archived ${esc(dateLabel(lesson.recordedOn))}</span></span><span class="archive-open" aria-hidden="true">＋</span></summary><div class="archive-detail"><div class="archive-focus">${focus}<br>${esc(lesson.summary || '')}</div>${grammar}${activities}</div></details>`;
  };
  const render = filter => {
    const query = (filter || '').trim().toLowerCase();
    const visible = lessons.filter(lesson => !query || [lesson.title, lesson.book, lesson.summary, ...(lesson.focus || [])].join(' ').toLowerCase().includes(query));
    const cards = visible.map(lessonMarkup).join('');
    panel.querySelector('.archive-list').innerHTML = cards || '<div class="archive-empty">No lessons match that search.</div>';
    panel.querySelector('.archive-result-count').textContent = `${visible.length} ${visible.length === 1 ? 'lesson' : 'lessons'}`;
  };
  const load = async () => {
    if (loaded) return;
    loaded = true;
    try {
      const response = await fetch('data/lessons.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Archive request failed (${response.status})`);
      const result = await response.json();
      lessons = Array.isArray(result.lessons) ? result.lessons : [];
      countLabel.textContent = String(lessons.length);
      render('');
    } catch (_) {
      panel.querySelector('.archive-list').innerHTML = '<div class="archive-empty">The lesson archive could not be loaded. Please refresh and try again.</div>';
    }
  };
  const open = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    panel.innerHTML = '<div class="archive-header"><div><span class="archive-kicker">YOUR STUDY HISTORY · PUBLIC ARCHIVE</span><h2 id="lessonArchiveTitle">Lesson archive</h2><p>Original answers, corrections, and natural alternatives, kept together for review.</p></div><button class="practice-close archive-close" type="button" aria-label="Close lesson archive">×</button></div><div class="archive-tools"><label class="archive-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search lessons, grammar, or vocabulary…" aria-label="Search archived lessons"></label><span class="archive-result-count"></span></div><div class="archive-list"><div class="archive-empty">Loading lessons…</div></div>';
    load();
    panel.querySelector('.archive-search input').addEventListener('input', event => render(event.target.value));
  };
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => panel.hidden ? open() : close());
  panel.addEventListener('click', event => {
    if (event.target.closest('.archive-close')) close();
  });
})();
