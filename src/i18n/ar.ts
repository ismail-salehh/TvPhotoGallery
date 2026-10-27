import type { Dictionary } from './index';

export const ar: Dictionary = {
  'app.name': 'معرض الصور',

  'common.back': '‹ رجوع',
  'common.retry': 'إعادة المحاولة',
  'common.photoCount': {
    zero: 'لا توجد صور',
    one: 'صورة واحدة',
    two: 'صورتان',
    few: '{count} صور',
    many: '{count} صورة',
    other: '{count} صورة',
  },
  'common.photoCredit': 'تصوير {name} على Unsplash',
  'common.position': '{current} / {total}',

  // What a screen reader says for a photo: one item, with its title
  'a11y.photo': '{title}، تصوير {name}',

  'status.loading.title': 'جارٍ التحميل…',
  'status.loading.slow': 'يستغرق هذا وقتًا أطول من المعتاد.',
  'status.empty.title': 'لا يوجد شيء هنا بعد',
  'status.empty.message': 'لا يوجد ما يمكن عرضه الآن.',
  'status.error.title': 'حدث خطأ ما',
  'status.error.message': 'يُرجى المحاولة مرة أخرى.',
  'status.offline.title': 'أنت غير متصل بالإنترنت',
  'status.offline.message': 'تحقق من اتصالك بالإنترنت، ثم حاول مرة أخرى.',
  'status.timeout': 'استغرق الخادم وقتًا طويلًا للرد. حاول مرة أخرى.',
  'status.crash.title': 'حدث خطأ هنا',
  'status.crash.message': 'واجه هذا الجزء من التطبيق مشكلة. باقي التطبيق يعمل.',
  'status.rateLimited':
    'طلبات كثيرة جدًا إلى Unsplash. انتظر قليلًا، ثم حاول مرة أخرى.',

  'home.searchPlaceholder': 'ابحث عن ألبومات',
  'home.rail': 'الألبومات {from}–{to}',
  'home.settings': 'الإعدادات',
  'home.loading': 'جارٍ تحميل الألبومات…',
  'home.loadFailed': 'تعذّر تحميل الألبومات',
  'home.loadMoreFailed': 'تعذّر تحميل المزيد من الألبومات',
  'home.emptyTitle': 'لا توجد ألبومات بعد',
  'home.emptyMessage': 'لم يُرجع Unsplash أي ألبومات.',

  'exit.title': 'الخروج من معرض الصور؟',
  'exit.confirm': 'خروج',
  'exit.cancel': 'إلغاء',

  'album.untitled': 'ألبوم بلا عنوان',
  'album.slideshow': '▶︎ عرض الشرائح',
  'album.search': 'بحث',
  'album.loading': 'جارٍ تحميل الصور…',
  'album.loadFailed': 'تعذّر تحميل الصور',
  'album.loadMoreFailed': 'تعذّر تحميل المزيد من الصور',
  'album.emptyTitle': 'لا توجد صور لعرضها',
  'album.emptyMessage': 'الصور في هذا الألبوم غير متاحة.',

  'album.opening': 'جارٍ تحميل الألبوم…',
  'album.openFailed': 'تعذّر تحميل هذا الألبوم',
  'album.missingTitle': 'لا يوجد ألبوم لعرضه',
  'album.missingMessage': 'هذا الألبوم غير متاح.',

  'photo.emptyTitle': 'لا توجد صورة لعرضها',
  'photo.emptyMessage': 'هذه الصورة غير متاحة.',
  'photo.unavailable': 'الصورة غير متاحة',
  'photo.loadFailed': 'تعذّر تحميل هذه الصورة',
  'photo.untitled': 'صورة من تصوير {name}',
  'photo.loading': 'جارٍ تحميل الصورة…',

  'slideshow.previous': 'السابق',
  'slideshow.next': 'التالي',
  'slideshow.play': 'تشغيل',
  'slideshow.pause': 'إيقاف مؤقت',
  'slideshow.every': 'كل {seconds} ث',
  'slideshow.speedTitle': 'سرعة العرض',
  'slideshow.emptyTitle': 'لا توجد صور لعرضها',
  'slideshow.emptyMessage': 'لا توجد صور لتشغيلها في هذا الألبوم.',
  'slideshow.loadFailed': 'تعذّر تحميل هذه الصور',

  'search.title': 'بحث',
  'search.searching': 'جارٍ البحث…',
  'search.loadMoreFailed': 'تعذّر تحميل المزيد من النتائج',
  'search.emptyMessage': 'جرّب بحثًا مختلفًا أو أقصر.',
  'search.albums.placeholder': 'ابحث عن ألبومات',
  'search.albums.hintTitle': 'ابحث في ألبومات Unsplash',
  'search.albums.hintMessage':
    'اكتب كلمة بالإنجليزية مثل “mountains” أو “coffee” للعثور على ألبومات.',
  'search.albums.loadFailed': 'تعذّر البحث عن الألبومات',
  'search.albums.emptyTitle': 'لا توجد ألبومات لـ “{query}”',
  'search.photos.title': 'بحث في “{album}”',
  'search.photos.placeholder': 'ابحث في هذا الألبوم',
  'search.photos.hintTitle': 'ابحث في هذا الألبوم',
  'search.photos.hintMessage':
    'اكتب كلمة بالإنجليزية مثل “tree” أو “sky” للعثور على صور في هذا الألبوم.',
  'search.photos.loadFailed': 'تعذّر البحث عن الصور',
  'search.photos.emptyTitle': 'لا توجد صور لـ “{query}” في هذا الألبوم',
  'search.space': 'مسافة',
  'search.delete': 'حذف',
  'search.clear': 'مسح',

  'settings.title': 'الإعدادات',
  'settings.slideshow': 'عرض الشرائح',
  'settings.speed': 'السرعة عند البدء',
  'settings.speedHint':
    'المدة التي تبقى فيها كل صورة على الشاشة عند بدء عرض الشرائح. يمكنك تغييرها أيضًا أثناء العرض.',
  'settings.seconds': {
    one: 'ثانية واحدة',
    two: 'ثانيتان',
    few: '{count} ثوانٍ',
    many: '{count} ثانية',
    other: '{count} ثانية',
  },
  'settings.language': 'اللغة',
  'settings.languageHint':
    'لغة القوائم والرسائل. تبقى عناوين الصور والألبومات كما يوفّرها Unsplash.',
  'settings.about': 'حول التطبيق',
  'settings.aboutDescription':
    'تصفّح ألبومات الصور وابحث فيها وشغّلها كعرض شرائح على التلفاز.',
  'settings.version': 'الإصدار {version}',
  'settings.device': 'الجهاز',
  'settings.system': 'النظام',
  'settings.unknown': 'غير معروف',
  'settings.photosCredit':
    'الصور مقدّمة من Unsplash، ويُذكر اسم كل مصوّر بجانب صوره.',
  'settings.controls':
    'استخدم الأسهم في جهاز التحكم للتنقل، وزر OK للاختيار، وزر الرجوع للعودة.',
};
