(() => {
  const STORE = 'jrevision-gamify-v1';
  const toggle = document.querySelector('#practiceToggle');
  const panel = document.querySelector('#practicePanel');
  const xpLabel = document.querySelector('#practiceXp');
  if (!toggle || !panel || !xpLabel) return;

  let state;
  try {
    state = JSON.parse(localStorage.getItem(STORE) || 'null') || {};
  } catch (_) {
    state = {};
  }
  state.xp = Number(state.xp) || 0;
  state.rounds = Number(state.rounds) || 0;
  state.badges = Array.isArray(state.badges) ? state.badges : [];
  state.seen = Array.isArray(state.seen) ? state.seen : [];
  state.review = Array.isArray(state.review) ? state.review : [];
  state.activeRound = state.activeRound || null;

  const esc = value => escapeHTML(String(value ?? ''));
  const save = () => {
    localStorage.setItem(STORE, JSON.stringify(state));
    xpLabel.textContent = `${state.xp} XP`;
  };
  const getPoint = n => data.points.find(point => point[0] === n);
  const visiblePoints = () => data.points.filter(p => {
    const chapterOk = activeChapter === 'all' || p[1] === Number(activeChapter);
    const done = reviewed.has(p[0]);
    const filterOk = activeFilter === 'all' || (activeFilter === 'reviewed' ? done : !done);
    const corpus = [p[0], p[1], data.chapters[p[1] - 1].title, p[2], p[3], p[4]].join(' ').toLowerCase();
    return chapterOk && filterOk && (!query.trim() || corpus.includes(query.trim().toLowerCase()));
  });
  const shuffle = values => [...values].sort(() => Math.random() - 0.5);
  const sourceLinks = n => {
    const refs = byPoint(n);
    if (!refs.length) return '<span class="practice-source-empty">No external reference attached</span>';
    return refs.map(ref => `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.label)} ↗</a>`).join('');
  };
  const exampleFor = n => (data.examples[String(n)] || []).find(example => {
    const matcher = highlightPatterns[n];
    return matcher && matcher.test(example);
  }) || (data.examples[String(n)] || [])[0] || '';
  const questionFor = (point, index) => {
    const [n, chapter, pattern, meaning, note] = point;
    const modes = ['meaning', 'pattern', 'cloze'];
    const mode = modes[index % modes.length];
    if (mode === 'meaning') {
      return { n, chapter, mode, prompt: meaning, answer: pattern, choices: optionsFor(point, 'pattern'), note };
    }
    if (mode === 'pattern') {
      return { n, chapter, mode, prompt: pattern, answer: meaning, choices: optionsFor(point, 'meaning'), note };
    }
    const example = exampleFor(n);
    const matcher = highlightPatterns[n];
    const match = matcher && matcher.exec(example);
    if (!match) return { n, chapter, mode: 'meaning', prompt: meaning, answer: pattern, choices: optionsFor(point, 'pattern'), note };
    const choices = optionsFor(point, 'pattern');
    const target = match[0];
    const clozeChoices = choices.map(choice => choice === pattern ? target : choice);
    if (!clozeChoices.includes(target)) clozeChoices[0] = target;
    return { n, chapter, mode, prompt: meaning, answer: target, choices: uniqueChoices(target, clozeChoices), note, example, start: match.index, end: match.index + target.length };
  };
  function uniqueChoices(answer, choices) {
    const rest = [...new Set(choices.filter(choice => choice !== answer))].slice(0, 3);
    return shuffle([answer, ...rest]);
  }
  function optionsFor(point, field) {
    const target = field === 'pattern' ? point[2] : point[3];
    const alternatives = shuffle(data.points.filter(other => other[0] !== point[0]).map(other => field === 'pattern' ? other[2] : other[3]));
    return uniqueChoices(target, [target, ...alternatives]);
  }
  const chapterBadge = chapter => `chapter-${chapter}`;
  const badgeNames = () => state.badges.map(badge => {
    if (badge === 'perfect') return 'Perfect round';
    const match = badge.match(/^chapter-(\d+)$/);
    return match ? `Chapter ${String(match[1]).padStart(2, '0')}` : badge;
  });
  const badgeMarkup = () => badgeNames().length
    ? badgeNames().map(name => `<span class="practice-badge">✦ ${esc(name)}</span>`).join('')
    : '<span class="practice-muted">Badges appear as you complete chapters.</span>';
  const summaryMarkup = () => {
    const count = Math.min(5, visiblePoints().length);
    return `<div class="practice-heading"><div><span class="practice-kicker">OPTIONAL RECALL MODE</span><h2 id="practiceTitle">A little practice, one pattern at a time.</h2><p>${count ? `${count} quick questions` : 'No matching questions'} from the chapter or results you’re viewing. Your notes and examples stay linked to their source.</p></div><button class="practice-close" type="button" aria-label="Close practice panel">×</button></div><div class="practice-stats"><div><b>${state.xp}</b><span>XP earned</span></div><div><b>${state.rounds}</b><span>Rounds finished</span></div><div><b>${state.review.length}</b><span>To revisit</span></div></div><div class="practice-badges">${badgeMarkup()}</div><div class="practice-actions"><button class="practice-primary" data-action="start" type="button" ${count ? '' : 'disabled'}>Start a ${count}-question round <span>→</span></button><span class="practice-hint">Correct answers earn 10 XP, or 5 XP with a hint. No timer.</span></div>`;
  };
  const startRound = () => {
    const available = visiblePoints();
    if (!available.length) return;
    const prioritized = state.review.map(n => available.find(point => point[0] === n)).filter(Boolean);
    const selected = [...prioritized, ...shuffle(available.filter(point => !prioritized.some(p => p[0] === point[0])))].slice(0, 5);
    const questions = selected.map((point, i) => ({ ...questionFor(point, i), retry: false, wrongOnce: false, hinted: false }));
    state.activeRound = { questions, index: 0, correctFirst: 0, total: questions.length, seenThisRound: [], hinted: false, answered: 0 };
    save();
    renderRound();
  };
  const finishRound = () => {
    const round = state.activeRound;
    if (!round) return;
    state.rounds += 1;
    const perfect = round.correctFirst === round.total && round.answered === round.total;
    if (perfect && !state.badges.includes('perfect')) state.badges.push('perfect');
    const chapters = [...new Set(round.seenThisRound.map(n => getPoint(n)?.[1]).filter(Boolean))];
    for (const chapter of chapters) {
      const chapterPoints = data.points.filter(p => p[1] === chapter).map(p => p[0]);
      if (chapterPoints.every(n => state.seen.includes(n)) && !state.badges.includes(chapterBadge(chapter))) state.badges.push(chapterBadge(chapter));
    }
    state.activeRound = null;
    save();
    panel.innerHTML = `<div class="practice-heading"><div><span class="practice-kicker">ROUND COMPLETE</span><h2 id="practiceTitle">Nice work. Keep the patterns moving.</h2><p>You earned <b>${round.roundXp || 0} XP</b> in this round. Missed questions are saved for another try.</p></div><button class="practice-close" type="button" aria-label="Close practice panel">×</button></div><div class="practice-badges">${badgeMarkup()}</div><div class="practice-actions"><button class="practice-primary" data-action="start" type="button">Play another round <span>→</span></button><span class="practice-hint">Your reviewed checklist is unchanged.</span></div>`;
  };
  const renderRound = () => {
    const round = state.activeRound;
    if (!round) return panel.innerHTML = summaryMarkup();
    if (round.index >= round.questions.length) return finishRound();
    const q = round.questions[round.index];
    const point = getPoint(q.n);
    const isCloze = q.mode === 'cloze';
    const progress = q.retry ? 'Review question' : `${round.answered + 1} / ${round.total}`;
    const prompt = isCloze && q.example
      ? `${esc(q.example.slice(0, q.start))}<span class="practice-blank">＿＿＿＿</span>${esc(q.example.slice(q.end))}`
      : esc(q.prompt);
    const hint = q.hinted ? `<div class="practice-feedback practice-hint-box"><b>Hint</b><p>${esc(q.note)}${q.example ? `<br><span lang="ja">${esc(q.example)}</span>` : ''}</p></div>` : '';
    const feedback = q.result ? `<div class="practice-feedback ${q.result.correct ? 'is-correct' : 'is-wrong'}"><b>${q.result.correct ? 'Correct' : 'Not quite'}</b><p>${q.result.correct ? `${esc(q.answer)} — ${esc(point[3])}` : `The answer is ${esc(q.answer)}.`} ${esc(q.note)}</p>${q.example ? `<p class="practice-example" lang="ja">${highlightExample(q.n, q.example)}</p>` : ''}<div class="practice-source">Your notes · 第${String(q.chapter).padStart(2, '0')}課 · #${q.n}<br>${sourceLinks(q.n)}</div></div>` : '';
    const choices = q.result ? '' : `<div class="practice-choices" role="group" aria-label="Answer choices">${q.choices.map((choice, i) => `<button class="practice-choice" type="button" data-choice="${i}"><span>${String.fromCharCode(65 + i)}</span>${esc(choice)}</button>`).join('')}</div>`;
    panel.innerHTML = `<div class="practice-heading"><div><span class="practice-kicker">${q.retry ? 'REVISIT' : 'PRACTICE ROUND'} · CHAPTER ${String(q.chapter).padStart(2, '0')} · #${q.n}</span><h2 id="practiceTitle">Question ${progress}<span class="practice-progress"><i style="width:${Math.min(100, (round.answered / round.total) * 100)}%"></i></span></h2></div><button class="practice-close" type="button" aria-label="Close practice panel">×</button></div><div class="practice-question"><span class="practice-mode">${isCloze ? 'COMPLETE THE EXAMPLE' : q.mode === 'meaning' ? 'CHOOSE THE PATTERN' : 'CHOOSE THE MEANING'}</span><p ${isCloze ? 'lang="ja"' : ''}>${prompt}</p></div>${hint}${choices}${!q.result ? '<button class="practice-hint-button" type="button" data-action="hint">Show a hint</button>' : ''}${feedback}${q.result ? `<div class="practice-nextrow"><span>${round.roundXp || 0} XP this round</span><button class="practice-primary" type="button" data-action="next">${round.index + 1 >= round.questions.length ? 'Finish round' : 'Next question'} <span>→</span></button></div>` : ''}`;
  };
  const handleChoice = index => {
    const round = state.activeRound;
    const q = round?.questions[round.index];
    if (!q || q.result) return;
    const selected = q.choices[index];
    const correct = selected === q.answer;
    q.result = { correct };
    if (!round.seenThisRound.includes(q.n)) round.seenThisRound.push(q.n);
    if (!state.seen.includes(q.n)) state.seen.push(q.n);
    if (correct) {
      if (!q.retry) round.correctFirst += 1;
      const award = q.retry ? 5 : q.hinted ? 5 : 10;
      state.xp += award;
      round.roundXp = (round.roundXp || 0) + award;
      state.review = state.review.filter(n => n !== q.n);
    } else {
      if (!state.review.includes(q.n)) state.review.push(q.n);
      if (!q.wrongOnce) {
        q.wrongOnce = true;
        const retry = { ...q, retry: true, wrongOnce: true, hinted: false, result: null };
        round.questions.push(retry);
      }
    }
    round.answered += 1;
    save();
    renderRound();
  };
  const showPanel = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (state.activeRound) renderRound(); else panel.innerHTML = summaryMarkup();
  };
  const hidePanel = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => panel.hidden ? showPanel() : hidePanel());
  panel.addEventListener('click', event => {
    const close = event.target.closest('.practice-close');
    if (close) return hidePanel();
    const choice = event.target.closest('[data-choice]');
    if (choice) return handleChoice(Number(choice.dataset.choice));
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'start') return startRound();
    if (action === 'hint') {
      const q = state.activeRound?.questions[state.activeRound.index];
      if (q) { q.hinted = true; save(); renderRound(); }
    }
    if (action === 'next') {
      const round = state.activeRound;
      if (round) { round.index += 1; renderRound(); save(); }
    }
  });
  const waitForData = () => {
    if (typeof data !== 'undefined' && data?.points?.length) {
      save();
      if (state.activeRound) showPanel();
      return;
    }
    setTimeout(waitForData, 80);
  };
  waitForData();
})();
