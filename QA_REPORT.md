# QA report — KAV Reception demo

Проверено: `2026-08-04T14:19:01+03:00`

## Итог

**PASS.** Локальный продающий прототип открывается и проходит оба целевых сценария. Блокирующих дефектов не осталось.

## Фактически выполнено

### Static / syntax

Команда:

```bash
python3 scripts/verify_demo.py
```

Результат:

```text
PASS: index.html is self-contained
PASS: 19 unique element IDs; required UI anchors present
PASS: RU/HE copy, both channels, pricing, handoff, and test API markers present
PASS: inline JavaScript passes node --check
```

### Browser smoke

Команда:

```bash
node scripts/browser_smoke.js http://127.0.0.1:8765/
```

Проверено реальными browser actions:

- desktop `1440×1000`;
- персонализация бизнеса и города;
- WhatsApp booking: день → слот → создание заявки;
- Owner Desk: inbox → leads → daily summary → owner action;
- переключение на Hebrew и `dir=rtl`;
- Telegram handoff: длина → время ответа → передача владельцу → owner takeover;
- цена остаётся LTR внутри Hebrew RTL;
- console errors: `0`;
- failed requests: `0`;
- external requests: `0`;
- mobile touch viewport `390×844`;
- горизонтальный overflow: отсутствует;
- chat и Owner Desk складываются вертикально;
- минимальная высота проверенных touch targets: `44px`.

Результат:

```json
{
  "result": "PASS",
  "desktop": {
    "viewport": "1440x1000",
    "booking": "PASS",
    "ownerTabs": "PASS",
    "ownerAction": "PASS",
    "hebrewRtl": "PASS",
    "handoff": "PASS",
    "consoleErrors": 0,
    "failedRequests": 0,
    "externalRequests": 0
  },
  "mobile": {
    "viewport": "390x844 touch",
    "horizontalOverflow": false,
    "stackedWorkspace": true,
    "minimumTouchTarget": "44px",
    "consoleErrors": 0,
    "failedRequests": 0,
    "externalRequests": 0
  }
}
```

## Visual evidence

- `assets/screenshots/desktop-demo.png` — 1440×1000
- `assets/screenshots/mobile-demo.png` — 390×844

Вручную просмотрены desktop RU и Hebrew RTL. Обрезаний, горизонтального overflow и наложений в реальном viewport не обнаружено.

## Исправлено во время QA

1. Диапазоны `₪2,500–5,000` и `₪600–2,000` переупорядочивались bidi-алгоритмом в RTL. Числовые диапазоны изолированы как LTR.
2. Скрытые aria-labels оставались русскими после переключения на иврит. Добавлена RU/HE-локализация.
3. Часть компактных controls была ниже 44px. Все ключевые mobile touch targets доведены минимум до 44px.

## Slop diagnostic

Финальный счёт: **0/10**.

- нет glossy tech gradient;
- нет indigo/violet по умолчанию;
- нет сетки из трёх одинаковых feature tiles;
- нет декоративных accent rails или glassmorphism-карточек;
- нет выдуманных monument stats;
- нет icon toppers;
- композиция не центрирована без причины;
- типографика выбрана сознательно: Georgia + Trebuchet/Arial Hebrew fallback;
- поверхность соответствует задаче: Decide/Learn с полноценным вторичным Operate workspace.

## Открытые ограничения (не дефекты)

- Это детерминированная локальная симуляция, а не подключённая AI/WhatsApp/Telegram-система.
- CSV и clipboard работают только локально в браузере.
- Реальные интеграции и уведомления требуют отдельного пилота, официальных доступов владельца и end-to-end приёмки.

## Дополнительная проверка clinic-safe preset — 2026-08-04T16:26:46+03:00

Добавлен адресный `profile=dental` с ограниченными query-параметрами `business`, `city`, `lang=ru|he`. Значения остаются в браузере и отображаются как текст; профиль не создаёт сетевых запросов.

Повторно выполнены static verifier и полный Playwright smoke. Итог: **PASS**.

- исходный salon desktop flow: PASS;
- исходный mobile touch flow: PASS;
- dental RU booking: PASS;
- dental RU explicit staff handoff: PASS;
- dental HE RTL после переключения: PASS;
- отсутствие salon-only `стрижка/окрашивание` и `תספורת/צביעה` в dental chat: PASS;
- явный запрет медицинских советов/оценки симптомов/автоматического триажа: PASS;
- console errors: `0`;
- failed requests: `0`;
- external requests: `0`.

Проверенный адресный пример:

`/?profile=dental&business=Shenhavit+Dental+Center&city=Bat+Yam&lang=ru`

## Дополнительная проверка real-estate preset — 2026-08-08T08:13:14+03:00

Добавлен `profile=realestate` с отдельными RU/HE-сценариями продавца и покупателя. Профиль собирает тип объекта и желаемое время ответа, но оставляет оценку стоимости, наличие, цену, переговоры и юридические/финансовые вопросы человеку.

Повторно выполнены static verifier, `git diff --check`, JavaScript/Python syntax checks и полный Playwright smoke. Итог: **PASS**.

- исходный salon desktop flow: PASS;
- исходный mobile touch flow: PASS;
- clinic/dental preset: PASS;
- real-estate HE seller qualification: PASS;
- real-estate HE buyer-to-agent handoff: PASS;
- переключение real-estate HE RTL → RU LTR: PASS;
- граница автоматической оценки/цены: PASS;
- console errors: `0`;
- failed requests: `0`;
- external requests: `0`.

Проверенный адресный пример:

`/?profile=realestate&business=Kopel+Realty+Demo&city=Rishon+LeZion&lang=he`
