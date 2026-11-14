# Публикация на Cloudflare Pages

Основной адрес игры — [skrepkus.ayku.ru](https://skrepkus.ayku.ru/).

## Локальная проверка

Используйте Node.js 22 из `.nvmrc` и npm:

```bash
npm ci
npm run check
npm run build
npm run check:publication
```

Для просмотра сборки запустите `npm run preview`.

## Настройки Pages

Подключите репозиторий GitHub к [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/).

| Параметр | Значение |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm ci && npm run check && npm run build && npm run check:publication` |
| Build output directory | `dist` |
| Build variable | `SKIP_DEPENDENCY_INSTALL=1` |
| Node.js | 22, из `.nvmrc` |

Переменная отключает автоматическую установку зависимостей, чтобы сборка использовала `npm ci`.
После первой сборки добавьте `skrepkus.ayku.ru` в разделе **Custom domains** проекта Pages
и подтвердите DNS-запись. [Инструкция Cloudflare](https://developers.cloudflare.com/pages/configuration/custom-domains/).

`public/_headers` задаёт заголовки сайта. `public/404.html` отвечает за неизвестные адреса,
включая удалённые страницы.

## Проверка после публикации

1. Откройте главную по HTTPS. Проверьте запуск, музыку, сохранение после перезагрузки и мобильный экран.
2. Убедитесь, что неизвестный путь возвращает HTTP 404.
3. Откройте `/robots.txt`, `/sitemap.xml`, `/social/paperclips.png` и `/licenses/project-mit.txt`.
4. Проверьте ссылку в мессенджере. В исходном HTML `canonical`, `og:url` и URL изображения должны указывать на основной домен.

## Превью и лицензии

Готовое PNG-превью размером 1200 × 630 хранится в `public/social/paperclips.png`.
Чтобы пересобрать его, после установки npm-зависимостей выполните:

```bash
python -m pip install pillow fonttools
python scripts/generate_social_cards.py
```

При смене домена обновите адрес в `index.html`, `public/robots.txt`, `public/sitemap.xml`,
`scripts/check-publication.mjs`, README и в этой инструкции.

Сборка включает MIT, уведомления об авторстве и лицензию IBM Plex Mono в каталоге `licenses/`.
См. [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
