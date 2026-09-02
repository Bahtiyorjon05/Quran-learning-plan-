/**
 * The names of the 114 surahs, in each language the product speaks.
 *
 * The shipped Qur'an index carries only the Arabic name and an English
 * transliteration, because that is all the source provides. So a reader in
 * Uzbek saw "Al-Baqara · The Cow" on an otherwise Uzbek page, and a reader in
 * Russian saw the same. These are the missing halves.
 *
 * Two fields per language, and they do different jobs:
 *
 *   name     what the surah is called — a transliteration of the Arabic, in
 *            the form that language's mushafs actually print.
 *   meaning  what the name means, which is a translation rather than a
 *            transliteration: Al-Baqara is "Sigir" in Uzbek and "Корова" in
 *            Russian. Empty where the name is a proper noun (Yusuf, Maryam)
 *            or a set of disjoined letters (Ta-Ha, Ya-Sin), because inventing
 *            a gloss for those would be worse than leaving them alone.
 *
 * Authored rather than fetched — no open source carries all three languages —
 * so the accompanying test checks the shape, and a native reader should check
 * the wording. Anything wrong here is wrong on a page of the Qur'an.
 */

export type SurahNaming = {
  /** Uzbek name, and what it means. */
  uz: string;
  uzMeaning: string;
  /** Russian name, and what it means. */
  ru: string;
  ruMeaning: string;
};

/** Indexed by surah number − 1. */
export const SURAH_NAMES: readonly SurahNaming[] = [
  { uz: "Fotiha", uzMeaning: "Ochuvchi", ru: "Аль-Фатиха", ruMeaning: "Открывающая" },
  { uz: "Baqara", uzMeaning: "Sigir", ru: "Аль-Бакара", ruMeaning: "Корова" },
  { uz: "Oli Imron", uzMeaning: "Imron oilasi", ru: "Аль-Имран", ruMeaning: "Семейство Имрана" },
  { uz: "Niso", uzMeaning: "Ayollar", ru: "Ан-Ниса", ruMeaning: "Женщины" },
  { uz: "Moida", uzMeaning: "Dasturxon", ru: "Аль-Маида", ruMeaning: "Трапеза" },
  { uz: "Anʼom", uzMeaning: "Chorva", ru: "Аль-Анам", ruMeaning: "Скот" },
  { uz: "Aʼrof", uzMeaning: "Aʼrof balandliklari", ru: "Аль-Араф", ruMeaning: "Преграды" },
  { uz: "Anfol", uzMeaning: "Oʻljalar", ru: "Аль-Анфаль", ruMeaning: "Трофеи" },
  { uz: "Tavba", uzMeaning: "Tavba", ru: "Ат-Тауба", ruMeaning: "Покаяние" },
  { uz: "Yunus", uzMeaning: "", ru: "Юнус", ruMeaning: "" },
  { uz: "Hud", uzMeaning: "", ru: "Худ", ruMeaning: "" },
  { uz: "Yusuf", uzMeaning: "", ru: "Юсуф", ruMeaning: "" },
  { uz: "Raʼd", uzMeaning: "Momaqaldiroq", ru: "Ар-Раад", ruMeaning: "Гром" },
  { uz: "Ibrohim", uzMeaning: "", ru: "Ибрахим", ruMeaning: "" },
  { uz: "Hijr", uzMeaning: "", ru: "Аль-Хиджр", ruMeaning: "" },
  { uz: "Nahl", uzMeaning: "Asalari", ru: "Ан-Нахль", ruMeaning: "Пчёлы" },
  { uz: "Isro", uzMeaning: "Tungi sayr", ru: "Аль-Исра", ruMeaning: "Ночной перенос" },
  { uz: "Kahf", uzMeaning: "Gʻor", ru: "Аль-Кахф", ruMeaning: "Пещера" },
  { uz: "Maryam", uzMeaning: "", ru: "Марьям", ruMeaning: "" },
  { uz: "Toha", uzMeaning: "", ru: "Та Ха", ruMeaning: "" },
  { uz: "Anbiyo", uzMeaning: "Paygʻambarlar", ru: "Аль-Анбия", ruMeaning: "Пророки" },
  { uz: "Haj", uzMeaning: "Haj", ru: "Аль-Хадж", ruMeaning: "Паломничество" },
  { uz: "Muʼminun", uzMeaning: "Moʻminlar", ru: "Аль-Муминун", ruMeaning: "Верующие" },
  { uz: "Nur", uzMeaning: "Nur", ru: "Ан-Нур", ruMeaning: "Свет" },
  { uz: "Furqon", uzMeaning: "Ajratuvchi", ru: "Аль-Фуркан", ruMeaning: "Различение" },
  { uz: "Shuaro", uzMeaning: "Shoirlar", ru: "Аш-Шуара", ruMeaning: "Поэты" },
  { uz: "Naml", uzMeaning: "Chumolilar", ru: "Ан-Намль", ruMeaning: "Муравьи" },
  { uz: "Qasas", uzMeaning: "Qissalar", ru: "Аль-Касас", ruMeaning: "Рассказ" },
  { uz: "Ankabut", uzMeaning: "Oʻrgimchak", ru: "Аль-Анкабут", ruMeaning: "Паук" },
  { uz: "Rum", uzMeaning: "Rumliklar", ru: "Ар-Рум", ruMeaning: "Римляне" },
  { uz: "Luqmon", uzMeaning: "", ru: "Лукман", ruMeaning: "" },
  { uz: "Sajda", uzMeaning: "Sajda", ru: "Ас-Саджда", ruMeaning: "Земной поклон" },
  { uz: "Ahzob", uzMeaning: "Ittifoqdoshlar", ru: "Аль-Ахзаб", ruMeaning: "Союзники" },
  { uz: "Sabaʼ", uzMeaning: "", ru: "Саба", ruMeaning: "" },
  { uz: "Fotir", uzMeaning: "Yaratuvchi", ru: "Фатир", ruMeaning: "Творец" },
  { uz: "Yosin", uzMeaning: "", ru: "Йа Син", ruMeaning: "" },
  { uz: "Soffot", uzMeaning: "Saf tortganlar", ru: "Ас-Саффат", ruMeaning: "Выстроившиеся в ряды" },
  { uz: "Sod", uzMeaning: "", ru: "Сад", ruMeaning: "" },
  { uz: "Zumar", uzMeaning: "Toʻdalar", ru: "Аз-Зумар", ruMeaning: "Толпы" },
  { uz: "Gʻofir", uzMeaning: "Kechiruvchi", ru: "Гафир", ruMeaning: "Прощающий" },
  { uz: "Fussilat", uzMeaning: "Batafsil bayon qilindi", ru: "Фуссылят", ruMeaning: "Разъяснены" },
  { uz: "Shuro", uzMeaning: "Maslahat", ru: "Аш-Шура", ruMeaning: "Совет" },
  { uz: "Zuxruf", uzMeaning: "Zebu ziynat", ru: "Аз-Зухруф", ruMeaning: "Украшения" },
  { uz: "Duxon", uzMeaning: "Tutun", ru: "Ад-Духан", ruMeaning: "Дым" },
  { uz: "Josiya", uzMeaning: "Tiz choʻkkanlar", ru: "Аль-Джасия", ruMeaning: "Коленопреклонённые" },
  { uz: "Ahqof", uzMeaning: "Qum tepalari", ru: "Аль-Ахкаф", ruMeaning: "Барханы" },
  { uz: "Muhammad", uzMeaning: "", ru: "Мухаммад", ruMeaning: "" },
  { uz: "Fath", uzMeaning: "Gʻalaba", ru: "Аль-Фатх", ruMeaning: "Победа" },
  { uz: "Hujurot", uzMeaning: "Hujralar", ru: "Аль-Худжурат", ruMeaning: "Комнаты" },
  { uz: "Qof", uzMeaning: "", ru: "Каф", ruMeaning: "" },
  { uz: "Zoriyot", uzMeaning: "Sochuvchi shamollar", ru: "Аз-Зарият", ruMeaning: "Рассеивающие" },
  { uz: "Tur", uzMeaning: "Tur togʻi", ru: "Ат-Тур", ruMeaning: "Гора" },
  { uz: "Najm", uzMeaning: "Yulduz", ru: "Ан-Наджм", ruMeaning: "Звезда" },
  { uz: "Qamar", uzMeaning: "Oy", ru: "Аль-Камар", ruMeaning: "Луна" },
  { uz: "Rahmon", uzMeaning: "Mehribon", ru: "Ар-Рахман", ruMeaning: "Милостивый" },
  { uz: "Voqea", uzMeaning: "Voqea", ru: "Аль-Вакиа", ruMeaning: "Событие" },
  { uz: "Hadid", uzMeaning: "Temir", ru: "Аль-Хадид", ruMeaning: "Железо" },
  { uz: "Mujodala", uzMeaning: "Bahslashuvchi ayol", ru: "Аль-Муджадила", ruMeaning: "Препирающаяся" },
  { uz: "Hashr", uzMeaning: "Toʻplanish", ru: "Аль-Хашр", ruMeaning: "Сбор" },
  { uz: "Mumtahana", uzMeaning: "Sinaluvchi ayol", ru: "Аль-Мумтахана", ruMeaning: "Испытуемая" },
  { uz: "Saff", uzMeaning: "Saf", ru: "Ас-Сафф", ruMeaning: "Ряды" },
  { uz: "Jumua", uzMeaning: "Juma", ru: "Аль-Джумуа", ruMeaning: "Пятница" },
  { uz: "Munofiqun", uzMeaning: "Munofiqlar", ru: "Аль-Мунафикун", ruMeaning: "Лицемеры" },
  { uz: "Tagʻobun", uzMeaning: "Aldanish", ru: "Ат-Тагабун", ruMeaning: "Взаимное обделение" },
  { uz: "Taloq", uzMeaning: "Taloq", ru: "Ат-Талак", ruMeaning: "Развод" },
  { uz: "Tahrim", uzMeaning: "Man qilish", ru: "Ат-Тахрим", ruMeaning: "Запрещение" },
  { uz: "Mulk", uzMeaning: "Podshohlik", ru: "Аль-Мульк", ruMeaning: "Власть" },
  { uz: "Qalam", uzMeaning: "Qalam", ru: "Аль-Калам", ruMeaning: "Письменная трость" },
  { uz: "Haqqa", uzMeaning: "Muqarrar voqea", ru: "Аль-Хакка", ruMeaning: "Неизбежное" },
  { uz: "Maorij", uzMeaning: "Zinapoyalar", ru: "Аль-Мaaридж", ruMeaning: "Ступени" },
  { uz: "Nuh", uzMeaning: "", ru: "Нух", ruMeaning: "" },
  { uz: "Jin", uzMeaning: "Jinlar", ru: "Аль-Джинн", ruMeaning: "Джинны" },
  { uz: "Muzzammil", uzMeaning: "Oʻranib olgan", ru: "Аль-Муззаммиль", ruMeaning: "Закутавшийся" },
  { uz: "Muddassir", uzMeaning: "Yopinib olgan", ru: "Аль-Муддассир", ruMeaning: "Завернувшийся" },
  { uz: "Qiyoma", uzMeaning: "Qiyomat", ru: "Аль-Кияма", ruMeaning: "Воскресение" },
  { uz: "Inson", uzMeaning: "Inson", ru: "Аль-Инсан", ruMeaning: "Человек" },
  { uz: "Mursalot", uzMeaning: "Yuborilganlar", ru: "Аль-Мурсалят", ruMeaning: "Посылаемые" },
  { uz: "Nabaʼ", uzMeaning: "Xabar", ru: "Ан-Наба", ruMeaning: "Весть" },
  { uz: "Noziot", uzMeaning: "Tortib oluvchilar", ru: "Ан-Назиат", ruMeaning: "Исторгающие" },
  { uz: "Abasa", uzMeaning: "Qovogʻini soldi", ru: "Абаса", ruMeaning: "Нахмурился" },
  { uz: "Takvir", uzMeaning: "Oʻralish", ru: "Ат-Таквир", ruMeaning: "Скручивание" },
  { uz: "Infitor", uzMeaning: "Yorilish", ru: "Аль-Инфитар", ruMeaning: "Раскалывание" },
  { uz: "Mutaffifin", uzMeaning: "Oʻlchovda urib qoluvchilar", ru: "Аль-Мутаффифин", ruMeaning: "Обвешивающие" },
  { uz: "Inshiqoq", uzMeaning: "Yorilib ketish", ru: "Аль-Иншикак", ruMeaning: "Разверзнется" },
  { uz: "Buruj", uzMeaning: "Burjlar", ru: "Аль-Бурудж", ruMeaning: "Созвездия" },
  { uz: "Toriq", uzMeaning: "Tunda keluvchi", ru: "Ат-Тарик", ruMeaning: "Ночной путник" },
  { uz: "Aʼlo", uzMeaning: "Eng oliy", ru: "Аль-Аля", ruMeaning: "Всевышний" },
  { uz: "Gʻoshiya", uzMeaning: "Qoplovchi", ru: "Аль-Гашия", ruMeaning: "Покрывающее" },
  { uz: "Fajr", uzMeaning: "Tong", ru: "Аль-Фаджр", ruMeaning: "Заря" },
  { uz: "Balad", uzMeaning: "Shahar", ru: "Аль-Баляд", ruMeaning: "Город" },
  { uz: "Shams", uzMeaning: "Quyosh", ru: "Аш-Шамс", ruMeaning: "Солнце" },
  { uz: "Layl", uzMeaning: "Tun", ru: "Аль-Лейль", ruMeaning: "Ночь" },
  { uz: "Zuho", uzMeaning: "Choshgoh", ru: "Ад-Духа", ruMeaning: "Утро" },
  { uz: "Sharh", uzMeaning: "Koʻksni kengaytirish", ru: "Аш-Шарх", ruMeaning: "Раскрытие" },
  { uz: "Tin", uzMeaning: "Anjir", ru: "Ат-Тин", ruMeaning: "Смоковница" },
  { uz: "Alaq", uzMeaning: "Laxta qon", ru: "Аль-Аляк", ruMeaning: "Сгусток крови" },
  { uz: "Qadr", uzMeaning: "Qadr kechasi", ru: "Аль-Кадр", ruMeaning: "Предопределение" },
  { uz: "Bayyina", uzMeaning: "Aniq hujjat", ru: "Аль-Баййина", ruMeaning: "Ясное знамение" },
  { uz: "Zalzala", uzMeaning: "Zilzila", ru: "Аз-Зальзаля", ruMeaning: "Землетрясение" },
  { uz: "Odiyot", uzMeaning: "Chopuvchi otlar", ru: "Аль-Адият", ruMeaning: "Скачущие" },
  { uz: "Qoria", uzMeaning: "Dahshatli voqea", ru: "Аль-Кариа", ruMeaning: "Великое бедствие" },
  { uz: "Takosur", uzMeaning: "Koʻpaytirishga berilish", ru: "Ат-Такасур", ruMeaning: "Приумножение" },
  { uz: "Asr", uzMeaning: "Asr vaqti", ru: "Аль-Аср", ruMeaning: "Предвечернее время" },
  { uz: "Humaza", uzMeaning: "Gʻiybatchi", ru: "Аль-Хумаза", ruMeaning: "Хулитель" },
  { uz: "Fil", uzMeaning: "Fil", ru: "Аль-Филь", ruMeaning: "Слон" },
  { uz: "Quraysh", uzMeaning: "", ru: "Курайш", ruMeaning: "" },
  { uz: "Moʻun", uzMeaning: "Yordam", ru: "Аль-Маун", ruMeaning: "Мелочь" },
  { uz: "Kavsar", uzMeaning: "Moʻl-koʻllik", ru: "Аль-Каусар", ruMeaning: "Изобилие" },
  { uz: "Kofirun", uzMeaning: "Kofirlar", ru: "Аль-Кафирун", ruMeaning: "Неверующие" },
  { uz: "Nasr", uzMeaning: "Yordam", ru: "Ан-Наср", ruMeaning: "Помощь" },
  { uz: "Masad", uzMeaning: "Xurmo tolasi", ru: "Аль-Масад", ruMeaning: "Пальмовые волокна" },
  { uz: "Ixlos", uzMeaning: "Sof eʼtiqod", ru: "Аль-Ихляс", ruMeaning: "Очищение веры" },
  { uz: "Falaq", uzMeaning: "Tong", ru: "Аль-Фаляк", ruMeaning: "Рассвет" },
  { uz: "Nos", uzMeaning: "Odamlar", ru: "Ан-Нас", ruMeaning: "Люди" },
];
