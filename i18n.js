/* =========================================================
   Переводы: English (по умолчанию), Русский, Oʻzbekcha.

   Как добавить строку:
     1. повесить data-i18n="some.key" на элемент в index.html
     2. добавить "some.key" во все три словаря ниже
   Текст, написанный прямо в index.html, — английский запасной вариант:
   если ключа нет в ru/uz, на странице останется английский.

   hero.roles — массив слов, которые по очереди печатаются в hero.
   ========================================================= */
window.I18N = {
  en: {
    'skip': 'Skip to content',
    'meta.description': 'Personal website of Pahlavon Numonjonov — about, experience, projects and contacts.',

    'a11y.theme': 'Toggle theme',
    'a11y.menu': 'Menu',
    'a11y.toTop': 'Back to top',

    'nav.about': 'About',
    'nav.experience': 'Experience',
    'nav.projects': 'Projects',
    'nav.skills': 'Skills',
    'nav.contact': 'Contact',

    'hero.eyebrow': 'Available for work',
    'hero.rolePrefix': "I'm a",
    'hero.roles': ['developer', 'designer', 'problem solver', 'lifelong learner'],
    'hero.tagline': 'One short line about what you do — for example, “I build web apps and automation tools, and I care about how they feel to use”.',
    'hero.cta1': 'View projects',
    'hero.cta2': 'Get in touch',

    'stats.1': 'Years of practice',
    'stats.2': 'Projects shipped',
    'stats.3': 'Languages spoken',

    'about.title': 'About me',
    'about.p1': 'Replace this paragraph with a few words about yourself: who you are, what you do and what you find interesting. Two or three sentences is plenty — people skim personal sites.',
    'about.p2': 'The second paragraph works best with specifics: where you study or work, what you are building right now, and what you can help with.',
    'about.locationLabel': 'Location',
    'about.locationValue': 'City, Country',
    'about.statusLabel': 'Status',
    'about.statusValue': 'Open to opportunities',
    'about.languagesLabel': 'Languages',
    'about.languagesValue': 'English, Русский, Oʻzbekcha',

    'exp.title': 'Experience',
    'exp.1.date': '2024 — now',
    'exp.1.role': 'Your role',
    'exp.1.org': 'Company or university',
    'exp.1.text': 'What you do there and what you are responsible for. One or two sentences — the specifics matter more than the length.',
    'exp.2.date': '2023 — 2024',
    'exp.2.role': 'Your role',
    'exp.2.org': 'Company or university',
    'exp.2.text': 'What you did there and what you achieved. Numbers work well here: users, revenue, hours saved.',
    'exp.3.date': '2022 — 2023',
    'exp.3.role': 'Where it started',
    'exp.3.org': 'Course, school or first job',
    'exp.3.text': 'How you got into this field and what you learned along the way.',

    'projects.title': 'Projects',
    'projects.featured': 'Featured',
    'projects.p1.title': 'Project name',
    'projects.p1.text': 'One or two sentences: what problem the project solves and what you personally built.',
    'projects.p2.title': 'Project name',
    'projects.p2.text': 'One or two sentences: what problem the project solves and what you personally built.',
    'projects.p3.title': 'Project name',
    'projects.p3.text': 'One or two sentences: what problem the project solves and what you personally built.',
    'projects.demo': 'Live demo ↗',
    'projects.code': 'Source ↗',
    'projects.more': 'Read more ↗',

    'skills.title': 'Skills',
    'skills.g1': 'Development',
    'skills.g2': 'Tools',
    'skills.g3': 'Other',
    'skills.communication': 'Communication',
    'skills.english': 'English',

    'contact.title': 'Contact',
    'contact.lead': 'Drop me a line — I read every email and message.',
    'contact.copy': 'Copy',
    'contact.copied': 'Email copied',

    'footer.top': 'Back to top ↑'
  },

  ru: {
    'skip': 'Перейти к содержимому',
    'meta.description': 'Личный сайт Pahlavon Numonjonov: о себе, опыт, проекты, контакты.',

    'a11y.theme': 'Переключить тему',
    'a11y.menu': 'Меню',
    'a11y.toTop': 'Наверх',

    'nav.about': 'Обо мне',
    'nav.experience': 'Опыт',
    'nav.projects': 'Проекты',
    'nav.skills': 'Навыки',
    'nav.contact': 'Контакты',

    'hero.eyebrow': 'Открыт к предложениям',
    'hero.rolePrefix': 'Я —',
    'hero.roles': ['разработчик', 'дизайнер', 'решаю задачи', 'постоянно учусь'],
    'hero.tagline': 'Короткая строка о том, чем вы занимаетесь — например, «делаю веб-приложения и автоматизацию, и мне важно, как ими пользуются».',
    'hero.cta1': 'Смотреть проекты',
    'hero.cta2': 'Связаться',

    'stats.1': 'Года в деле',
    'stats.2': 'Проектов сделано',
    'stats.3': 'Языка в активе',

    'about.title': 'Обо мне',
    'about.p1': 'Замените этот абзац рассказом о себе: кто вы, чем занимаетесь и что вам интересно. Двух-трёх предложений достаточно — личные сайты читают по диагонали.',
    'about.p2': 'Во втором абзаце хорошо работает конкретика: где учитесь или работаете, над чем работаете сейчас и чем можете помочь.',
    'about.locationLabel': 'Локация',
    'about.locationValue': 'Город, страна',
    'about.statusLabel': 'Статус',
    'about.statusValue': 'Открыт к предложениям',
    'about.languagesLabel': 'Языки',
    'about.languagesValue': 'English, Русский, Oʻzbekcha',

    'exp.title': 'Опыт',
    'exp.1.date': '2024 — сейчас',
    'exp.1.role': 'Ваша роль',
    'exp.1.org': 'Компания или университет',
    'exp.1.text': 'Чем занимаетесь и за что отвечаете. Одно-два предложения — конкретика важнее объёма.',
    'exp.2.date': '2023 — 2024',
    'exp.2.role': 'Ваша роль',
    'exp.2.org': 'Компания или университет',
    'exp.2.text': 'Что делали и чего добились. Здесь хорошо работают цифры: пользователи, выручка, сэкономленные часы.',
    'exp.3.date': '2022 — 2023',
    'exp.3.role': 'С чего всё началось',
    'exp.3.org': 'Курс, школа или первая работа',
    'exp.3.text': 'Как пришли в эту сферу и чему научились по дороге.',

    'projects.title': 'Проекты',
    'projects.featured': 'Главный',
    'projects.p1.title': 'Название проекта',
    'projects.p1.text': 'Одно-два предложения: какую задачу решает проект и что в нём сделали лично вы.',
    'projects.p2.title': 'Название проекта',
    'projects.p2.text': 'Одно-два предложения: какую задачу решает проект и что в нём сделали лично вы.',
    'projects.p3.title': 'Название проекта',
    'projects.p3.text': 'Одно-два предложения: какую задачу решает проект и что в нём сделали лично вы.',
    'projects.demo': 'Демо ↗',
    'projects.code': 'Код ↗',
    'projects.more': 'Подробнее ↗',

    'skills.title': 'Навыки',
    'skills.g1': 'Разработка',
    'skills.g2': 'Инструменты',
    'skills.g3': 'Прочее',
    'skills.communication': 'Коммуникация',
    'skills.english': 'Английский',

    'contact.title': 'Контакты',
    'contact.lead': 'Пишите — читаю все письма и сообщения.',
    'contact.copy': 'Скопировать',
    'contact.copied': 'Почта скопирована',

    'footer.top': 'Наверх ↑'
  },

  uz: {
    'skip': 'Asosiy qismga oʻtish',
    'meta.description': 'Pahlavon Numonjonovning shaxsiy sayti: men haqimda, tajriba, loyihalar, aloqa.',

    'a11y.theme': 'Mavzuni almashtirish',
    'a11y.menu': 'Menyu',
    'a11y.toTop': 'Yuqoriga',

    'nav.about': 'Men haqimda',
    'nav.experience': 'Tajriba',
    'nav.projects': 'Loyihalar',
    'nav.skills': 'Koʻnikmalar',
    'nav.contact': 'Aloqa',

    'hero.eyebrow': 'Takliflarga ochiqman',
    'hero.rolePrefix': 'Men —',
    'hero.roles': ['dasturchi', 'dizayner', 'muammolarni yechaman', 'doim oʻrganaman'],
    'hero.tagline': 'Nima bilan shugʻullanishingiz haqida qisqa satr — masalan, «veb-ilovalar va avtomatlashtirish yarataman, ular qanday ishlatilishi men uchun muhim».',
    'hero.cta1': 'Loyihalarni koʻrish',
    'hero.cta2': 'Bogʻlanish',

    'stats.1': 'Yillik tajriba',
    'stats.2': 'Tayyor loyiha',
    'stats.3': 'Biladigan til',

    'about.title': 'Men haqimda',
    'about.p1': 'Bu xatboshini oʻzingiz haqingizdagi matn bilan almashtiring: kimsiz, nima bilan shugʻullanasiz va sizga nima qiziq. Ikki-uchta gap yetarli — shaxsiy saytlarni odamlar yuzaki oʻqiydi.',
    'about.p2': 'Ikkinchi xatboshida aniqlik yaxshi ishlaydi: qayerda oʻqiysiz yoki ishlaysiz, hozir nima ustida ishlayapsiz va nimada yordam bera olasiz.',
    'about.locationLabel': 'Manzil',
    'about.locationValue': 'Shahar, davlat',
    'about.statusLabel': 'Holat',
    'about.statusValue': 'Takliflarga ochiqman',
    'about.languagesLabel': 'Tillar',
    'about.languagesValue': 'English, Русский, Oʻzbekcha',

    'exp.title': 'Tajriba',
    'exp.1.date': '2024 — hozir',
    'exp.1.role': 'Sizning lavozimingiz',
    'exp.1.org': 'Kompaniya yoki universitet',
    'exp.1.text': 'U yerda nima qilasiz va nimaga javobgarsiz. Bir-ikki gap — hajmdan koʻra aniqlik muhim.',
    'exp.2.date': '2023 — 2024',
    'exp.2.role': 'Sizning lavozimingiz',
    'exp.2.org': 'Kompaniya yoki universitet',
    'exp.2.text': 'Nima qilgansiz va nimaga erishgansiz. Bu yerda raqamlar yaxshi ishlaydi: foydalanuvchilar, daromad, tejalgan soatlar.',
    'exp.3.date': '2022 — 2023',
    'exp.3.role': 'Hammasi qayerdan boshlangan',
    'exp.3.org': 'Kurs, maktab yoki birinchi ish',
    'exp.3.text': 'Bu sohaga qanday kelgansiz va yoʻlda nimalarni oʻrgangansiz.',

    'projects.title': 'Loyihalar',
    'projects.featured': 'Asosiy',
    'projects.p1.title': 'Loyiha nomi',
    'projects.p1.text': 'Bir-ikki gap: loyiha qanday muammoni hal qiladi va unda shaxsan siz nima qildingiz.',
    'projects.p2.title': 'Loyiha nomi',
    'projects.p2.text': 'Bir-ikki gap: loyiha qanday muammoni hal qiladi va unda shaxsan siz nima qildingiz.',
    'projects.p3.title': 'Loyiha nomi',
    'projects.p3.text': 'Bir-ikki gap: loyiha qanday muammoni hal qiladi va unda shaxsan siz nima qildingiz.',
    'projects.demo': 'Demo ↗',
    'projects.code': 'Kod ↗',
    'projects.more': 'Batafsil ↗',

    'skills.title': 'Koʻnikmalar',
    'skills.g1': 'Dasturlash',
    'skills.g2': 'Vositalar',
    'skills.g3': 'Boshqa',
    'skills.communication': 'Muloqot',
    'skills.english': 'Ingliz tili',

    'contact.title': 'Aloqa',
    'contact.lead': 'Yozing — barcha xat va xabarlarni oʻqiyman.',
    'contact.copy': 'Nusxalash',
    'contact.copied': 'Pochta nusxalandi',

    'footer.top': 'Yuqoriga ↑'
  }
};
