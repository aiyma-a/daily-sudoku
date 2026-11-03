"use strict";
// Tiny translation helper: English and Russian. Language comes from the
// phone setting the first time; the EN / RU button in the footer changes it.
(function () {
  const RU = {
    "Daily Sudoku": "Судоку дня", "Daily": "Сегодня", "Practice": "Практика",
    "Easy": "Лёгкий", "Medium": "Средний", "Hard": "Сложный",
    "★ For me": "★ Мне", "Just right for you": "Как раз для вас",
    "‹ Previous": "‹ Назад", "New puzzle ›": "Новая ›",
    "Previous practice puzzle": "Предыдущая головоломка", "New practice puzzle": "Новая головоломка",
    "Sudoku board": "Поле судоку", "Mode": "Режим", "Difficulty": "Сложность", "Theme": "Тема",
    "Notes": "Заметки", "Erase": "Стереть", "Undo": "Отмена", "Hint": "Подсказка",
    "Classic": "Классика", "Fall": "Осень", "Cartoon": "Мульт",
    "Erase everything and start over": "Стереть всё и начать заново",
    "How it works (the machine learning)": "Как это работает (машинное обучение, на англ.)",
    "Privacy": "Конфиденциальность",
    "Solved! 🎉": "Решено! 🎉",
    "That one looks like a guess. Double-check its row, column and box.": "Похоже на догадку. Проверьте строку, столбец и квадрат.",
    "Erase everything on this puzzle and start over?": "Стереть всё в этой головоломке и начать заново?",
    "Taking a while? Tap Hint for a nudge.": "Долго думаете? Нажмите «Подсказка».",
    "Look at {where}: {why} (tap Hint again for the digit)": "Посмотрите: {where} — {why} (нажмите «Подсказка» ещё раз, чтобы увидеть цифру)",
    "Put {d} in {where}.": "Поставьте {d}: {where}.",
    "row {r}, column {c}": "строка {r}, столбец {c}",
    "This number looks wrong. Erase it first.": "Эта цифра неверна. Сначала сотрите её.",
    "No easy move here. Try pencil notes.": "Простого хода нет. Попробуйте заметки.",
    "one digit fits only here in its row, column or box.": "в строке, столбце или квадрате эта цифра подходит только сюда.",
    "only one digit can go in this cell.": "в эту клетку подходит только одна цифра.",
    "You finished all three today. Try Practice for more!": "Вы решили все три на сегодня. Попробуйте Практику!",
    "Just right: {lv}, about {m} min for you": "Как раз для вас: {lv}, примерно {m} мин",
    " (learned from {n} solves).": " (по вашим решениям: {n}).",
    " (a first guess; it learns as you solve).": " (пока наугад; подстраивается по мере решения).",
    "Today's puzzles are not saved on this phone yet. Open the game once with internet and they will work offline too.": "Сегодняшние головоломки ещё не сохранены на телефоне. Откройте игру один раз с интернетом, и они заработают офлайн.",
    "No connection and today's puzzle is not saved yet, so here is Practice (it works offline).": "Нет сети, а сегодняшняя головоломка не сохранена, поэтому открыта Практика (она работает офлайн).",
  };
  let lang = localStorage.getItem("ds:lang");
  if (lang !== "ru" && lang !== "en") lang = /^(ru|ky)/i.test(navigator.language || "") ? "ru" : "en";
  const t = (s, p) => {
    let out = lang === "ru" && RU[s] ? RU[s] : s;
    if (p) for (const k in p) out = out.split("{" + k + "}").join(p[k]);
    return out;
  };
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-label]").forEach((el) => {
      const s = t(el.dataset.i18nLabel); el.setAttribute("aria-label", s);
      if (el.hasAttribute("title")) el.setAttribute("title", s);
    });
    const pol = document.getElementById("policy");
    if (pol) pol.setAttribute("href", lang === "ru" ? "privacy-ru.html" : "privacy.html");
    const lb = document.getElementById("lang");
    if (lb) lb.textContent = lang === "ru" ? "EN" : "RU";
  }
  window.I18n = {
    t, apply, get lang() { return lang; },
    toggle() { lang = lang === "ru" ? "en" : "ru"; localStorage.setItem("ds:lang", lang); apply(); if (window.onLangChange) window.onLangChange(); },
  };
  apply();
})();
