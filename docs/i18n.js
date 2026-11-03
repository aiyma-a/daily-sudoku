"use strict";
// Tiny translation helper: English and Russian. Language comes from the
// phone setting the first time; the EN / RU button in the footer changes it.
(function () {
  const RU = {
    "Stats": "Статистика",
    "Settings": "Настройки",
    "How to play": "Как играть",
    "Close": "Закрыть",
    "Next": "Далее",
    "Skip": "Пропустить",
    "Start playing": "Играть",
    "1. Fill the board": "1. Заполните поле",
    "Fill every row, column and 3×3 box with the digits 1 to 9, each only once. Tap an empty cell, then tap a number.": "Заполните каждую строку, столбец и квадрат 3×3 цифрами от 1 до 9, без повторов. Нажмите на пустую клетку, затем на цифру.",
    "2. Use notes": "2. Используйте заметки",
    "Not sure? Turn on Notes and pencil in small candidate digits. They clear by themselves when you place a number.": "Не уверены? Включите «Заметки» и ставьте маленькие цифры-кандидаты. Они стираются сами, когда вы ставите цифру.",
    "3. Stuck? Ask for a hint": "3. Застряли? Попросите подсказку",
    "Tap Hint to see where to look, tap again for the digit. ★ For me picks the level that suits you. Daily is new every day; Practice never runs out and works offline.": "Нажмите «Подсказка», чтобы увидеть, куда смотреть, и ещё раз — чтобы увидеть цифру. «★ Мне» подберёт подходящий уровень. «Сегодня» — новая каждый день; «Практика» не кончается и работает офлайн.",
    "Show mistakes in red": "Показывать ошибки красным",
    "Sound": "Звук",
    "Vibration": "Вибрация",
    "On": "Вкл",
    "Off": "Выкл",
    "Current streak": "Текущая серия",
    "Best streak": "Лучшая серия",
    "days": "дн.",
    "Level": "Уровень",
    "Solved": "Решено",
    "Best": "Лучшее",
    "Average": "Среднее",
    "Nothing solved yet.": "Пока ничего не решено.",
    "Everything stays on this phone.": "Всё хранится только на этом телефоне.",
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
  const KY = {
    "Stats": "Статистика",
    "Settings": "Жөндөөлөр",
    "How to play": "Кантип ойноо",
    "Close": "Жабуу",
    "Next": "Кийинки",
    "Skip": "Өткөрүп жиберүү",
    "Start playing": "Ойноону баштоо",
    "1. Fill the board": "1. Тактаны толтуруңуз",
    "Fill every row, column and 3×3 box with the digits 1 to 9, each only once. Tap an empty cell, then tap a number.": "Ар бир сапты, мамычаны жана 3×3 чарчыны 1ден 9га чейинки сандар менен, кайталабай толтуруңуз. Бош уячаны, анан санды таптаңыз.",
    "2. Use notes": "2. Белгилерди колдонуңуз",
    "Not sure? Turn on Notes and pencil in small candidate digits. They clear by themselves when you place a number.": "Ишенбей жатасызбы? «Белгилер» баскычын күйгүзүп, кичинекей талапкер сандарды жазыңыз. Сан койгондо алар өзүнөн-өзү өчөт.",
    "3. Stuck? Ask for a hint": "3. Туруп калдыңызбы? Кеңеш сураңыз",
    "Tap Hint to see where to look, tap again for the digit. ★ For me picks the level that suits you. Daily is new every day; Practice never runs out and works offline.": "«Кеңеш» баскычын басып, кайдан караш керектигин көрүңүз, дагы бир басканда сан көрүнөт. «★ Мага» ылайыктуу деңгээлди тандайт. «Бүгүн» — күн сайын жаңы; «Машыгуу» бүтпөйт жана офлайн иштейт.",
    "Show mistakes in red": "Каталарды кызыл менен көрсөтүү",
    "Sound": "Үн",
    "Vibration": "Дирилдөө",
    "On": "Күйүк",
    "Off": "Өчүк",
    "Current streak": "Учурдагы катар",
    "Best streak": "Мыкты катар",
    "days": "күн",
    "Level": "Деңгээл",
    "Solved": "Чечилген",
    "Best": "Мыкты",
    "Average": "Орточо",
    "Nothing solved yet.": "Азырынча эч нерсе чечилген жок.",
    "Everything stays on this phone.": "Баары ушул телефондо гана сакталат.",
    "Daily Sudoku": "Күндүн судокусу", "Daily": "Бүгүн", "Practice": "Машыгуу",
    "Easy": "Жеңил", "Medium": "Орточо", "Hard": "Татаал",
    "★ For me": "★ Мага", "Just right for you": "Сизге ылайыктуу",
    "‹ Previous": "‹ Мурунку", "New puzzle ›": "Жаңы ›",
    "Previous practice puzzle": "Мурунку машыгуу табышмагы", "New practice puzzle": "Жаңы машыгуу табышмагы",
    "Sudoku board": "Судоку тактасы", "Mode": "Режим", "Difficulty": "Татаалдык", "Theme": "Тема",
    "Notes": "Белгилер", "Erase": "Өчүрүү", "Undo": "Артка", "Hint": "Кеңеш",
    "Classic": "Классика", "Fall": "Күз", "Cartoon": "Мультфильм",
    "Erase everything and start over": "Баарын өчүрүп, кайра баштоо",
    "How it works (the machine learning)": "Бул кандай иштейт (машинелик үйрөнүү, англисче)",
    "Privacy": "Купуялык",
    "Solved! 🎉": "Чечилди! 🎉",
    "That one looks like a guess. Double-check its row, column and box.": "Бул божомолго окшойт. Сапты, мамычаны жана чарчыны кайра текшериңиз.",
    "Erase everything on this puzzle and start over?": "Бул табышмактагы баарын өчүрүп, кайра баштайсызбы?",
    "Taking a while? Tap Hint for a nudge.": "Көпкө ойлонуп жатасызбы? «Кеңеш» баскычын басыңыз.",
    "Look at {where}: {why} (tap Hint again for the digit)": "Караңыз: {where} — {why} (санды көрүү үчүн «Кеңеш» баскычын дагы бир жолу басыңыз)",
    "Put {d} in {where}.": "{where}: {d} санын коюңуз.",
    "row {r}, column {c}": "{r}-сап, {c}-мамыча",
    "This number looks wrong. Erase it first.": "Бул сан туура эмес. Адегенде өчүрүңүз.",
    "No easy move here. Try pencil notes.": "Жөнөкөй жол жок. Белгилерди колдонуп көрүңүз.",
    "one digit fits only here in its row, column or box.": "сапта, мамычада же чарчыда бул сан ушул жерге гана туура келет.",
    "only one digit can go in this cell.": "бул уячага бир гана сан туура келет.",
    "You finished all three today. Try Practice for more!": "Бүгүнкү үчөөнү тең чечтиңиз. Дагы үчүн Машыгууну байкап көрүңүз!",
    "Just right: {lv}, about {m} min for you": "Сизге ылайыктуу: {lv}, болжол менен {m} мүн.",
    " (learned from {n} solves).": " ({n} чечимден үйрөндү).",
    " (a first guess; it learns as you solve).": " (алгач божомол; чечкен сайын үйрөнөт).",
    "Today's puzzles are not saved on this phone yet. Open the game once with internet and they will work offline too.": "Бүгүнкү табышмактар бул телефонго али сакталган эмес. Оюнду интернет менен бир жолу ачыңыз, анан алар офлайн да иштейт.",
    "No connection and today's puzzle is not saved yet, so here is Practice (it works offline).": "Интернет жок жана бүгүнкү табышмак сакталган эмес, ошондуктан Машыгуу ачылды (ал офлайн иштейт).",
  };
  const DICT = { ru: RU, ky: KY };
  let lang = localStorage.getItem("ds:lang");
  if (!["en", "ru", "ky"].includes(lang)) { const n = (navigator.language || "").slice(0, 2).toLowerCase(); lang = n === "ru" || n === "ky" ? n : "en"; }
  const t = (s, p) => {
    let out = (DICT[lang] && DICT[lang][s]) || s;
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
    if (pol) pol.setAttribute("href", lang === "en" ? "privacy.html" : `privacy-${lang}.html`);
    document.querySelectorAll("#langs button").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  }
  window.I18n = {
    t, apply, get lang() { return lang; },
    set(l) { lang = l; localStorage.setItem("ds:lang", lang); apply(); if (window.onLangChange) window.onLangChange(); },
  };
  apply();
})();
