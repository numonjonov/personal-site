/* =========================================================
   Переводы: English (по умолчанию), Русский, Oʻzbekcha.

   Как править: нашли нужный блок — поправили текст во всех трёх
   словарях. Названия команд (help, about, projects…) не переводятся:
   это команды, их набирают одинаково на любом языке.

   Порядок элементов в projects.items и experience.items должен
   совпадать с порядком в site.js.
   ========================================================= */
window.I18N = {

  /* ===================== ENGLISH ===================== */
  en: {
    ui: {
      skip: 'Skip to the command line',
      placeholder: 'type help and press enter',
      themeLabel: 'Toggle theme',
      statusLang: 'lang', statusTheme: 'theme', statusBg: 'bg', statusHint: 'try',
      boot1: '{handle} {version} — personal terminal',
      boot2: 'type <b>help</b> for the list of commands',
      notFound: 'command not found:',
      notFoundHint: 'type <b>help</b> to see what works',
      featured: 'featured',
      langChanged: 'language →',
      themeChanged: 'theme →',
      langUsage: 'usage: lang en | ru | uz',
      themeUsage: 'usage: theme light | dark',
      openUsage: 'usage: open 001 | 002 | 003',
      openMissing: 'no project with id',
      opening: 'opening',
      sudo: 'nice try. permission denied — but I like the way you think.',
      konami: 'up up down down left right left right b a — you know your classics.',
      bgChanged: 'background →',
      bgUsage: 'usage: bg on | off',
      bgMissing: 'background is not available here',
      cursorChanged: 'cursor →',
      cursorUsage: 'usage: cursor on | off',
      cursorMissing: 'custom cursor is not available on touch screens'
    },

    help: {
      intro: 'Available commands:',
      rows: [
        ['whoami',     'who I am, in one line'],
        ['about',      'longer intro and basic facts'],
        ['experience', 'where I worked and studied'],
        ['projects',   'selected work with links'],
        ['skills',     'what I use day to day'],
        ['contact',    'email and social links'],
        ['open <id>',  'open a project link, e.g. open 001'],
        ['lang <code>','switch language: en, ru, uz'],
        ['theme',      'switch light / dark'],
        ['bg',         'turn the 3D background on or off'],
        ['cursor',     'terminal-style cursor on or off'],
        ['clear',      'clear the screen']
      ],
      footer: 'Tip: ↑ and ↓ walk through history, Tab completes a command.'
    },

    whoami: {
      role: 'developer',
      line: 'One short line about what you do — replace it with your own.'
    },

    about: {
      paragraphs: [
        'Replace this paragraph with a few words about yourself: who you are, what you do and what you find interesting.',
        'The second paragraph works best with specifics: where you study or work, what you are building right now, and what you can help with.'
      ],
      facts: [
        ['location',  'City, Country'],
        ['status',    'open to opportunities'],
        ['languages', 'English / Русский / Oʻzbekcha']
      ]
    },

    experience: {
      items: [
        { role: 'Your role',        org: 'Company or university',      text: 'What you do there and what you are responsible for.' },
        { role: 'Your role',        org: 'Company or university',      text: 'What you did there and what you achieved. Numbers work well here.' },
        { role: 'Where it started', org: 'Course, school or first job', text: 'How you got into this field and what you learned.' }
      ]
    },

    projects: {
      items: [
        { title: 'Project name', text: 'What problem the project solves and what you personally built.' },
        { title: 'Project name', text: 'What problem the project solves and what you personally built.' },
        { title: 'Project name', text: 'What problem the project solves and what you personally built.' }
      ],
      linkLabels: { demo: 'live demo', code: 'source', more: 'read more' },
      note: 'Run <b>open 001</b> to follow the first link of a project.'
    },

    skills: {
      groups: ['development', 'tools', 'other'],
      extra: ['communication', 'english']
    },

    contact: {
      lead: 'Drop me a line — I read every email and message.',
      labels: { email: 'email', github: 'github', telegram: 'telegram', linkedin: 'linkedin' }
    }
  },

  /* ===================== РУССКИЙ ===================== */
  ru: {
    ui: {
      skip: 'Перейти к командной строке',
      placeholder: 'наберите help и нажмите enter',
      themeLabel: 'Переключить тему',
      statusLang: 'язык', statusTheme: 'тема', statusBg: 'фон', statusHint: 'наберите',
      boot1: '{handle} {version} — личный терминал',
      boot2: 'наберите <b>help</b>, чтобы увидеть список команд',
      notFound: 'команда не найдена:',
      notFoundHint: 'наберите <b>help</b> — там список рабочих команд',
      featured: 'главный',
      langChanged: 'язык →',
      themeChanged: 'тема →',
      langUsage: 'как пользоваться: lang en | ru | uz',
      themeUsage: 'как пользоваться: theme light | dark',
      openUsage: 'как пользоваться: open 001 | 002 | 003',
      openMissing: 'нет проекта с номером',
      opening: 'открываю',
      sudo: 'хорошая попытка. доступ запрещён — но ход мысли мне нравится.',
      konami: '↑↑↓↓←→←→ b a — классику знаешь.',
      bgChanged: 'фон →',
      bgUsage: 'как пользоваться: bg on | off',
      bgMissing: 'фон здесь недоступен',
      cursorChanged: 'курсор →',
      cursorUsage: 'как пользоваться: cursor on | off',
      cursorMissing: 'свой курсор на сенсорных экранах недоступен'
    },

    help: {
      intro: 'Доступные команды:',
      rows: [
        ['whoami',     'кто я, одной строкой'],
        ['about',      'подробнее о себе и основные факты'],
        ['experience', 'где работал и учился'],
        ['projects',   'избранные проекты со ссылками'],
        ['skills',     'чем пользуюсь каждый день'],
        ['contact',    'почта и ссылки'],
        ['open <id>',  'открыть ссылку проекта, например open 001'],
        ['lang <code>','сменить язык: en, ru, uz'],
        ['theme',      'светлая / тёмная тема'],
        ['bg',         'включить или выключить 3D-фон'],
        ['cursor',     'свой курсор — включить или выключить'],
        ['clear',      'очистить экран']
      ],
      footer: 'Подсказка: ↑ и ↓ листают историю, Tab дополняет команду.'
    },

    whoami: {
      role: 'разработчик',
      line: 'Короткая строка о том, чем вы занимаетесь — замените своей.'
    },

    about: {
      paragraphs: [
        'Замените этот абзац рассказом о себе: кто вы, чем занимаетесь и что вам интересно.',
        'Во втором абзаце хорошо работает конкретика: где учитесь или работаете, над чем работаете сейчас и чем можете помочь.'
      ],
      facts: [
        ['локация', 'Город, страна'],
        ['статус',  'открыт к предложениям'],
        ['языки',   'English / Русский / Oʻzbekcha']
      ]
    },

    experience: {
      items: [
        { role: 'Ваша роль',           org: 'Компания или университет',       text: 'Чем занимаетесь и за что отвечаете.' },
        { role: 'Ваша роль',           org: 'Компания или университет',       text: 'Что делали и чего добились. Здесь хорошо работают цифры.' },
        { role: 'С чего всё началось', org: 'Курс, школа или первая работа',  text: 'Как пришли в эту сферу и чему научились.' }
      ]
    },

    projects: {
      items: [
        { title: 'Название проекта', text: 'Какую задачу решает проект и что в нём сделали лично вы.' },
        { title: 'Название проекта', text: 'Какую задачу решает проект и что в нём сделали лично вы.' },
        { title: 'Название проекта', text: 'Какую задачу решает проект и что в нём сделали лично вы.' }
      ],
      linkLabels: { demo: 'демо', code: 'код', more: 'подробнее' },
      note: 'Наберите <b>open 001</b>, чтобы открыть первую ссылку проекта.'
    },

    skills: {
      groups: ['разработка', 'инструменты', 'прочее'],
      extra: ['коммуникация', 'английский']
    },

    contact: {
      lead: 'Пишите — читаю все письма и сообщения.',
      labels: { email: 'почта', github: 'github', telegram: 'telegram', linkedin: 'linkedin' }
    }
  },

  /* ===================== OʻZBEKCHA ===================== */
  uz: {
    ui: {
      skip: 'Buyruq satriga oʻtish',
      placeholder: 'help deb yozing va enter bosing',
      themeLabel: 'Mavzuni almashtirish',
      statusLang: 'til', statusTheme: 'mavzu', statusBg: 'fon', statusHint: 'yozing',
      boot1: '{handle} {version} — shaxsiy terminal',
      boot2: 'buyruqlar roʻyxati uchun <b>help</b> deb yozing',
      notFound: 'buyruq topilmadi:',
      notFoundHint: 'ishlaydigan buyruqlar uchun <b>help</b> deb yozing',
      featured: 'asosiy',
      langChanged: 'til →',
      themeChanged: 'mavzu →',
      langUsage: 'qoʻllanishi: lang en | ru | uz',
      themeUsage: 'qoʻllanishi: theme light | dark',
      openUsage: 'qoʻllanishi: open 001 | 002 | 003',
      openMissing: 'bunday raqamli loyiha yoʻq:',
      opening: 'ochilmoqda',
      sudo: 'urinish yaxshi. ruxsat yoʻq — lekin fikringiz menga yoqdi.',
      konami: '↑↑↓↓←→←→ b a — klassikani bilar ekansiz.',
      bgChanged: 'fon →',
      bgUsage: 'qoʻllanishi: bg on | off',
      bgMissing: 'bu yerda fon mavjud emas',
      cursorChanged: 'kursor →',
      cursorUsage: 'qoʻllanishi: cursor on | off',
      cursorMissing: 'sensorli ekranlarda oʻz kursori mavjud emas'
    },

    help: {
      intro: 'Mavjud buyruqlar:',
      rows: [
        ['whoami',     'men kimman, bir satrda'],
        ['about',      'oʻzim haqimda batafsil va asosiy maʼlumotlar'],
        ['experience', 'qayerda ishlaganman va oʻqiganman'],
        ['projects',   'tanlangan loyihalar va havolalar'],
        ['skills',     'har kuni nimadan foydalanaman'],
        ['contact',    'pochta va havolalar'],
        ['open <id>',  'loyiha havolasini ochish, masalan open 001'],
        ['lang <code>','tilni almashtirish: en, ru, uz'],
        ['theme',      'yorugʻ / qorongʻi mavzu'],
        ['bg',         '3D fonni yoqish yoki oʻchirish'],
        ['cursor',     'oʻz kursorini yoqish yoki oʻchirish'],
        ['clear',      'ekranni tozalash']
      ],
      footer: 'Maslahat: ↑ va ↓ tarixni varaqlaydi, Tab buyruqni toʻldiradi.'
    },

    whoami: {
      role: 'dasturchi',
      line: 'Nima bilan shugʻullanishingiz haqida qisqa satr — oʻzingiznikiga almashtiring.'
    },

    about: {
      paragraphs: [
        'Bu xatboshini oʻzingiz haqingizdagi matn bilan almashtiring: kimsiz, nima bilan shugʻullanasiz va sizga nima qiziq.',
        'Ikkinchi xatboshida aniqlik yaxshi ishlaydi: qayerda oʻqiysiz yoki ishlaysiz, hozir nima ustida ishlayapsiz va nimada yordam bera olasiz.'
      ],
      facts: [
        ['manzil', 'Shahar, davlat'],
        ['holat',  'takliflarga ochiqman'],
        ['tillar', 'English / Русский / Oʻzbekcha']
      ]
    },

    experience: {
      items: [
        { role: 'Sizning lavozimingiz',      org: 'Kompaniya yoki universitet',    text: 'U yerda nima qilasiz va nimaga javobgarsiz.' },
        { role: 'Sizning lavozimingiz',      org: 'Kompaniya yoki universitet',    text: 'Nima qilgansiz va nimaga erishgansiz. Bu yerda raqamlar yaxshi ishlaydi.' },
        { role: 'Hammasi qayerdan boshlangan', org: 'Kurs, maktab yoki birinchi ish', text: 'Bu sohaga qanday kelgansiz va nimalarni oʻrgangansiz.' }
      ]
    },

    projects: {
      items: [
        { title: 'Loyiha nomi', text: 'Loyiha qanday muammoni hal qiladi va unda shaxsan siz nima qildingiz.' },
        { title: 'Loyiha nomi', text: 'Loyiha qanday muammoni hal qiladi va unda shaxsan siz nima qildingiz.' },
        { title: 'Loyiha nomi', text: 'Loyiha qanday muammoni hal qiladi va unda shaxsan siz nima qildingiz.' }
      ],
      linkLabels: { demo: 'demo', code: 'kod', more: 'batafsil' },
      note: 'Loyihaning birinchi havolasini ochish uchun <b>open 001</b> deb yozing.'
    },

    skills: {
      groups: ['dasturlash', 'vositalar', 'boshqa'],
      extra: ['muloqot', 'ingliz tili']
    },

    contact: {
      lead: 'Yozing — barcha xat va xabarlarni oʻqiyman.',
      labels: { email: 'pochta', github: 'github', telegram: 'telegram', linkedin: 'linkedin' }
    }
  }
};
