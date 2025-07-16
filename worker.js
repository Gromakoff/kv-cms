// worker.js — Cloudflare Workers CMS с визуальным редактором меню, страниц, авторизацией и ToastUI Editor

const PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"; // sha256('admin')

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function renderPage(env, slug) {
  const raw = await env.CMS_KV.get(`page:${slug}`);
  if (!raw) return new Response("404 Not Found", { status: 404 });

  const data = JSON.parse(raw);
  const settingsRaw = await env.CMS_KV.get("site:settings");
  const settings = settingsRaw ? JSON.parse(settingsRaw) : {
    menu: [],
    logoUrl: "",
    faviconUrl: "",
    footerText: "",
    buttonUrl: "",
    buttonText: "",
    enableTrafficFilter: "falce"
  };

  const trafficFilterScript = settings.enableTrafficFilter ? `
  <script>
  document.addEventListener('DOMContentLoaded', function () {
    const ref = document.referrer.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
  
    const allowedReferrers = [
      'google.', 'bing.com', 'yahoo.com',
      'yandex.', 'ya.ru', 'zen.yandex.ru',
      'duckduckgo.com', 'baidu.com', 'ecosia.org',
      'search.brave.com', 'qwant.com', 'startpage.com',
      'ask.com', 'seznam.cz', 'aol.com', 'naver.com',
      'sogou.com', 'yippy.com', 'gibiru.com', 'gigablast.com',
      'telegra.ph', 'medium.com'
    ];
  
    const knownBots = [
      'googlebot', 'bingbot', 'yandexbot', 'slurp', 'duckduckbot',
      'baiduspider', 'seznambot', 'facebot', 'facebookexternalhit',
      'twitterbot', 'applebot', 'petalbot', 'sogou', 'yahoo! slurp',
      'mj12bot', 'semrushbot', 'ahrefsbot', 'dotbot', 'megaindex',
      'serpstatbot', 'seekport', 'linkpadbot', 'sistrix crawler',
      'gdnplus', 'crawler4j', 'zumobot', 'rogerbot', 'siteauditbot',
      'lighthouse', 'pagespeed', '360spider', 'embedly', 'crawler',
      'python-requests', 'wget', 'curl', 'axios', 'httpclient',
      'go-http-client', 'apache-httpclient', 'urlpreviewbot',
      'google-inspectiontool', 'chrome-lighthouse', 'phantomjs',
      'puppeteer', 'headless', 'rendertron', 'prerender',
      'selenium', 'playwright'
    ];
  
    const trustedAgents = [
      'telegram', 'tdesktop', 'androidtelegram', 'iostelegram'
    ];
  
    const isSearchTraffic = allowedReferrers.some(domain => ref.includes(domain));
    const isBot = knownBots.some(bot => userAgent.includes(bot));
    const isTrustedApp = trustedAgents.some(agent => userAgent.includes(agent));
  
    if (!isSearchTraffic && !isBot && !isTrustedApp) {
      const main = document.getElementById('main-content');
      const fallback = document.getElementById('fallback-message');
      if (main && fallback) {
        main.style.display = 'none';
        fallback.style.display = 'block';
      }
    }
  });
  </script>
  ` : '';

  const menuHtml = generateMenuHtml(settings.menu || []);
  const html = `
  <!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
    <title>${data.title}</title>
    ${data.seo_meta}
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="canonical" href="/${slug}">
    <meta name="robots" content="index, follow">   
    ${settings.faviconUrl
      ? `<link rel="icon" type="image/x-icon" href="${settings.faviconUrl}">`
      : ""}
    <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
    <style>${data.style || ''}</style>
    <style>
      body{font-family:sans-serif;margin:0;padding:0;}
      header,footer{background:#f5f5f5;}
      header {    margin: 0 0 30px 0;  padding:0rem 0;  }
      footer {    margin: 30px 0 0 0;  padding:1rem 0;  }
      .container{max-width:1200px;margin:0 auto;padding:0 1rem;}
      nav ul{list-style:none;padding:0;display:flex;gap:1rem}
      nav ul li ul{display:none;position:absolute;background:#fff;padding:0.5rem}
      nav ul li:hover ul{display:block}
      h1{margin-top:0}.faq-item{margin:1rem 0;}
      .faq-item h3{cursor:pointer;margin:0}
      .faq-item div{display:none;padding:0.5rem 0;}
      /* Горизонтальное меню по центру с белым фоном */
      .site-menu {
        display: flex;
        justify-content: center;
        list-style: none;
        margin: 0;
        padding: 0.5rem 0;
        background-color: transparent;  /* либо #fff, если нужен жёсткий белый фон */
      }
    
      .site-menu > li {
        margin: 0 1rem;
        position: relative;
      }
    
      .site-menu a {
        color: #000;                    /* чёрный текст ссылок */
        text-decoration: none;
        padding: 0.25rem 0;
        display: inline-block;
      }
    
      .site-menu img {
        width: 1em;
        height: 1em;
        margin-right: 0.25em;
        vertical-align: middle;
      }
    
      /* Вложенное подменю */
      .site-menu li ul {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        background: #fff;      
        list-style: none;
        padding: 0.5rem 0;
        margin: 0;
        border-radius: var(--pico-border-radius);
        box-shadow: 0px 6px 15px 0px rgba(0, 0, 0, 0.2); 
      }
    
      .site-menu li:hover > ul {
        display: block;
      }
    
      .site-menu li ul li a {
        display: block;
        padding: 0.25rem 1rem;
        color: #000;                    /* чёрный текст в выпадашке */
      }
    
      .site-menu li ul li a:hover {
        background: rgba(0,0,0,0.05);   /* мягкий hover */
      }

      a.button,
      a.primary,
      a.secondary,
      a.contrast,
      a.outline {
        display: inline-block;
        margin: 0;
        padding: 0.5em 1.25em;
        border: none;
        border-radius: 0.5em;
        background: var(--pico-background-color, #eee);
        color: var(--pico-contrast, #222);
        font: inherit;
        font-size: 1em;
        text-decoration: none;
        cursor: pointer;
        text-align: center;
        transition: background 0.2s, color 0.2s;
        box-sizing: border-box;
        vertical-align: middle;
        line-height: 1.2;
        user-select: none;
      }
      a.button:focus,
      a.button:hover,
      a.primary:focus,
      a.primary:hover,
      a.secondary:focus,
      a.secondary:hover,
      a.contrast:focus,
      a.contrast:hover,
      a.outline:focus,
      a.outline:hover {
        filter: brightness(0.96);
        text-decoration: none;
      }
      
      /* Для классов, как в pico */
      a.primary     { background: var(--pico-primary-background, #0d6efd); color: var(--pico-primary-contrast, #fff); }
      a.secondary   { background: var(--pico-secondary-background, #6c757d); color: var(--pico-secondary-contrast, #fff);}
      a.contrast    { background: var(--pico-contrast-background, #222); color: #fff;}
      a.outline     { background: transparent; border: 1.5px solid var(--pico-primary-background, #0d6efd); color: var(--pico-primary-background, #0d6efd);}
      a.outline:hover, a.outline:focus {
        background: var(--pico-primary-background, #0d6efd);
        color: var(--pico-primary-contrast, #fff);
      }


    </style>
    <script>
      document.addEventListener("DOMContentLoaded",()=>{
        document.querySelectorAll(".faq-item h3").forEach(h=>{
          h.onclick=()=>{const d=h.nextElementSibling;d.style.display=d.style.display==='block'?'none':'block'}
        });
      });
    </script>
  </head><body><main id="main-content" style="padding:0;">
  <header>
  <div class="container"
       style="display:flex; align-items:center; justify-content:space-between;">
    <!-- Левый блок: логотип -->
    ${settings.logoUrl
      ? `<a href="/"><img src="${settings.logoUrl}" alt="Logo" style="height:40px;"></a>`
      : ""}

    <!-- Центр: меню -->
    <nav>
    <ul class="site-menu">${generateMenuHtml(settings.menu || [])}</ul>
    </nav>

    <!-- Право: кнопка -->
    ${settings.buttonUrl && settings.buttonText
      ? `<a href="${settings.buttonUrl}" class="contrast">
           ${settings.buttonText}
         </a>`
      : ""}
  </div>
</header>

    <div class="container">
      
      <div>
      ${
        // Если это старая страница с полем content
        data.content
        // Иначе, если есть массив blocks — рендерим каждый блок по его типу
        || (Array.isArray(data.blocks)
        ? data.blocks.map(block => {
            switch (block.type) {
              case 'raw':
              case 'pico':    // ← добавили обработку pico-блоков
                return block.data.html;
              case 'header':
                return `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
              case 'paragraph':
                return `<p>${block.data.text}</p>`;
              case 'list':
                const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
                return `<${tag}>${block.data.items.map(item => `<li>${item}</li>`).join('')}</${tag}>`;
              case 'toggle':
                return `<details><summary>${block.data.title}</summary>${block.data.content}</details>`;
              default:
                return '';
            }
          }).join('')
        : ''
          )
      }
    </div>


    </div>
    <footer>
    <div class="container" style="text-align:center;">
    ${settings.logoUrl
      ? `<a href="/"><img src="${settings.logoUrl}" alt="Logo" style="height:40px;"></a>`
      : ""}
      <span>${settings.footerText || `© ${new Date().getFullYear()}`}</span>
    </div>


  </footer></main>
  
  <div id="fallback-message" style="display:none; box-sizing:border-box; min-height:100vh; background:#fff; color:#333; font-family: 'Segoe UI', Arial, sans-serif; margin:0; padding:0;">
  <div style="max-width:610px; margin:14vh auto 0; text-align:left;">
    <!-- Грустный файл SVG как у Chrome -->
    <div style="margin-bottom:36px;">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQAQMAAADdiHD7AAAABlBMVEUAAABTU1OoaSf/AAAAAXRSTlMAQObYZgAAAFJJREFUeF7t0cENgDAMQ9FwYgxG6WjpaIzCCAxQxVggFuDiCvlLOeRdHR9yzjncHVoq3npu+wQUrUuJHylSTmBaespJyJQoObUeyxDQb3bEm5Au81c0pSCD8HYAAAAASUVORK5CYII="
    alt="Sad file" width="72" height="72" style="display:inline-block;"/>
    </div>
    <h1 style="font-weight:600; font-size:1.2rem; margin:0 0 0.8em 0;">Страница недоступна</h1>
    <div style="color:#555; font-size:0.8em; margin-bottom:2em; line-height:1.6;">
      <span>Сайт не отправил данных.</span>
      <br>
      <span style="color:#5f6368; font-size:0.8em;">ERR_EMPTY_RESPONSE</span>
    </div>
    <div>
      <button onclick="location.reload()" style="padding:7px 26px; background:#1a73e8; color:#fff; border:none; border-radius:20px; font-size:0.6em; cursor:pointer;">Перезагрузить</button>
    </div>
  </div>
</div>
  ${trafficFilterScript}
  </body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

function generateMenuHtml(menu) {
  return menu
    .map(item => {
      const iconHtml = item.icon
        ? `<img src="${item.icon}" alt="" /> `
        : "";
      const linkHtml = `<a href="/${item.slug}">${iconHtml}${item.title}</a>`;

      if (item.children && item.children.length) {
        return `
          <li>
            ${linkHtml}
            <ul>
              ${generateMenuHtml(item.children)}
            </ul>
          </li>
        `;
      }
      return `<li>${linkHtml}</li>`;
    })
    .join("");
}

// Рендеринг формы логина
async function renderLogin() {
  return new Response(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Вход в админку</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
  </head>
  <body>
    <main class="container">
    <form method="POST" action="/pandora/login">
        <h1>Вход в админку</h1>
        <label for="password">Пароль</label>
        <input type="password" id="password" name="password" required>
        <button type="submit">Войти</button>
      </form>
    </main>
  </body>
</html>`, {
    headers: { "Content-Type": "text/html" }
  });
}

// Обработка POST-запроса логина
async function handleLogin(request) {
  const form = await request.formData();
  const pwd  = form.get("password") || "";
  const hash = await sha256(pwd);
  if (hash === PASSWORD_HASH) {
    // Устанавливаем HttpOnly-cookie и перенаправляем в админку
    return new Response(null, {
      status: 302,
      headers: {
        "Set-Cookie": `auth=${hash}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        "Location": "/pandora"
      }
    });
  }
  // Неверный пароль — показываем форму с сообщением
  return new Response(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Вход в админку — Ошибка</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
  </head>
  <body>
    <main class="container">
      <form method="POST" action="/pandora/login">
        <h1>Вход в админку</h1>
        <p style="color:red;">Неверный пароль</p>
        <label for="password">Пароль</label>
        <input type="password" id="password" name="password" required>
        <button type="submit">Войти</button>
      </form>
    </main>
  </body>
</html>`, {
    headers: { "Content-Type": "text/html" }
  });
}

async function renderAdmin(request, env, url) {
  // проверяем cookie auth
  const cookieHeader = request.headers.get("Cookie") || "";
  const authCookie = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("auth="));
  const hash = authCookie ? authCookie.split("=")[1] : "";
  if (hash !== PASSWORD_HASH) {
    return new Response(null, {
      status: 302,
      headers: { "Location": "/pandora/login" }
    });
  }
  const path = url.pathname;

if ((path === "/pandora" || path === "/pandora/") && request.method === "GET") {
  const raw = await env.CMS_KV.get("site:settings");
  const settings = raw ? JSON.parse(raw) : {
    menu: [], logoUrl: "", logoCode: "", footerText: "",
    buttonUrl: "", buttonText: "",enableTrafficFilter: false
  };
       return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8">
       <title>Admin Panel</title>
       <meta name="viewport" content="width=device-width, initial-scale=1">
       <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
       <style> body{max-width:700px;margin:2rem auto;padding:1rem;} 
       .settings-section {        background: #f6f6f8;        padding: 2rem 1.5rem 1.5rem 1.5rem;   border-radius: 1rem;    margin-bottom: 2rem;      }
      .settings-section h2 { color: #000;  font-size: 2rem;   font-weight: bold;   margin-top: 0;  margin-bottom: 1.5rem;  letter-spacing: 0.01em;}</style>
       </head><body>
         <div class="container">
           <h1>Админка</h1>
           <ul>
             <li><a href="/pandora/pages">Редактировать страницы</a></li>
             <li><a href="/pandora/menu">Редактировать меню</a></li>
           </ul>
    
          
           <form id="settingsForm">

           <!-- ШАПКА -->
           <div class="settings-section">
             <h2>Шапка</h2>
         
             <label for="logoFile">Загрузить логотип (PNG/JPG/SVG):</label>
             <input type="file" id="logoFile" accept="image/*">
         
             <label for="logoUrl">Или URL логотипа:</label>
             <input type="url" id="logoUrl" value="${settings.logoUrl || ""}" placeholder="https://…">
         
             <label for="buttonUrl">URL кнопки в шапке:</label>
             <input type="url" id="buttonUrl" value="${settings.buttonUrl || ""}" placeholder="https://example.com">
         
             <label for="buttonText">Текст кнопки в шапке:</label>
             <input type="text" id="buttonText" value="${settings.buttonText || ""}" placeholder="Заказать">
           </div>
         
           <!-- ФУТЕР -->
           <div class="settings-section">
             <h2>Футер</h2>
             <label for="footerText">Текст в футере:</label>
             <input type="text" id="footerText" value="${settings.footerText || ""}" placeholder="© 2025 …">
           </div>
         
           <!-- SEO -->
           <div class="settings-section">
             <h2>SEO и трафик</h2>
         
             <label for="faviconFile">Загрузить фавикон (ico/png/svg):</label>
             <input type="file" id="faviconFile" accept="image/x-icon,image/png,image/svg+xml">
         
             <label for="faviconUrl">Или URL фавикона:</label>
             <input type="url" id="faviconUrl" value="${settings.faviconUrl || ""}" placeholder="https://…">
         
             <label>
               <input type="checkbox" id="enableTrafficFilter" ${settings.enableTrafficFilter ? "checked" : ""}>
               Включить фильтр трафика
             </label>
           </div>
         
           <button type="submit">Сохранить настройки</button>
         </form>
       
         <script>
         document.getElementById("settingsForm").addEventListener("submit", async e => {
          e.preventDefault();
        
          // 1. Логотип: файл или url
          const fileInput = document.getElementById("logoFile");
          let logoUrl = "";
          if (fileInput.files.length) {
            logoUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject("Не удалось прочитать файл");
              reader.readAsDataURL(fileInput.files[0]);
            });
          } else {
            logoUrl = document.getElementById("logoUrl").value.trim();
          }
        
          // 2. Фавикон: файл или url
          const faviconInput = document.getElementById("faviconFile");
          let faviconUrl = "";
          if (faviconInput.files.length) {
            faviconUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject("Не удалось прочитать файл");
              reader.readAsDataURL(faviconInput.files[0]);
            });
          } else {
            faviconUrl = document.getElementById("faviconUrl").value.trim();
          }
        
          const footerText = document.getElementById("footerText").value.trim();
          const buttonUrl  = document.getElementById("buttonUrl").value.trim();
          const buttonText = document.getElementById("buttonText").value.trim();
          const enableTrafficFilter = document.getElementById("enableTrafficFilter").checked;
        
          await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              logoUrl,
              faviconUrl,
              footerText,
              buttonUrl,
              enableTrafficFilter,
              buttonText
            })
          });
        
          alert("Настройки сохранены");
          location.reload();
        });
        
         </script>
       </body>
       </html>`, {
           headers: { "Content-Type": "text/html" }
         });
       }

  if (path === "/pandora/pages") return renderPageEditor(env);
  if (path === "/pandora/menu") return renderMenuEditor(env);
  return new Response("Not Found", { status: 404 });
}


async function renderPageEditor(env) {
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Редактор страниц</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
<link rel="stylesheet" href="https://unpkg.com/grapesjs@0.21.7/dist/css/grapes.min.css">
  <link rel="stylesheet" href="https://unpkg.com/codemirror@5.65.2/lib/codemirror.css">

  <script src="https://unpkg.com/grapesjs@0.21.7"></script>
  <script src="https://unpkg.com/codemirror@5.65.2/lib/codemirror.js"></script>

  <script src="https://unpkg.com/grapesjs-preset-webpage@1.0.3/dist/index.js"></script>
  
  <script src="https://unpkg.com/grapesjs-rte-toolbar-extensions@1.0.8/dist/index.js"></script>
  <script src="https://unpkg.com/grapesjs-code-editor@0.1.2/dist/grapesjs-code-editor.umd.cjs"></script>
  <style>
    body { width: 80%; margin: 2rem auto; }
    #editor-wrapper {      resize: vertical;      overflow: auto;      max-height: 80vh;      border: 1px solid var(--gray-300);    }
  
    .controls .save-btn {      background-color: #28a745;      color: white;    }
 
    .controls .delete-btn {      background-color: #dc3545;      color: white;    }

    .controls {      display: flex;      gap: 0.5rem;      align-items: center;      margin-bottom: 1rem;    }
    .controls select {  flex: 1 1 auto;      margin-bottom: 0;
    }
    .container > #gjs {      max-width: none !important;      width: 100vw !important;      margin: 0 auto !important;      padding: 0 !important;    }
  
    a.button,
    a.primary,
    a.secondary,
    a.contrast,
    a.outline {
      display: inline-block;
      margin: 0;
      padding: 0.5em 1.25em;
      border: none;
      border-radius: 0.5em;
      background: var(--pico-background-color, #eee);
      color: var(--pico-contrast, #222);
      font: inherit;
      font-size: 1em;
      text-decoration: none;
      cursor: pointer;
      text-align: center;
      transition: background 0.2s, color 0.2s;
      box-sizing: border-box;
      vertical-align: middle;
      line-height: 1.2;
      user-select: none;
    }
    a.button:focus,
    a.button:hover,
    a.primary:focus,
    a.primary:hover,
    a.secondary:focus,
    a.secondary:hover,
    a.contrast:focus,
    a.contrast:hover,
    a.outline:focus,
    a.outline:hover {
      filter: brightness(0.96);
      text-decoration: none;
    }
    
    /* Для классов, как в pico */
    a.primary     { background: var(--pico-primary-background, #0d6efd); color: var(--pico-primary-contrast, #fff); }
    a.secondary   { background: var(--pico-secondary-background, #6c757d); color: var(--pico-secondary-contrast, #fff);}
    a.contrast    { background: var(--pico-contrast-background, #222); color: #fff;}
    a.outline     { background: transparent; border: 1.5px solid var(--pico-primary-background, #0d6efd); color: var(--pico-primary-background, #0d6efd);}
    a.outline:hover, a.outline:focus {
      background: var(--pico-primary-background, #0d6efd);
      color: var(--pico-primary-contrast, #fff);
    }
  
    details.dropdown[open] > * { display: block !important; }
    </style>
  </head><body><div class="container">
  <p><a href="/pandora" class="contrast">← Главное меню</a></p>
    <h1>Редактор страниц</h1>
    <div class="controls">
    <select id="pageList"></select>
    <button onclick="load()">Загрузить</button>
    <button id="copy-btn" title="Копировать выбранную страницу" style="background:#adb5bd;color:white;">
  <!-- иконка копирования SVG -->
  <svg width="22" height="22" viewBox="0 0 20 20"><rect x="6" y="2" width="12" height="14" rx="2" fill="#fff" stroke="#555" stroke-width="2"/><rect x="2" y="6" width="12" height="12" rx="2" fill="#fff" stroke="#555" stroke-width="2"/></svg>
</button>
    <button class="save-btn"   onclick="save()">Сохранить</button>
    <button class="delete-btn" onclick="del()">Удалить</button>
    
  </div>
    <div><input id="title" placeholder="Заголовок"/></div>
    <div><input id="slug" placeholder="Slug"/></div>

     <div id="editor-wrapper">
  <div id="gjs" style="height:800px; border:1px solid var(--gray-300);"></div>
</div>

<div style="margin-top:2em; padding:1em; background:#f6f6f6; border-radius:12px;">
  <h3>SEO / Open Graph (мета-теги)</h3>
  <textarea id="seo_meta" style="width:100%; min-height:160px; font-family:monospace;"></textarea>
  <small>Вставьте сюда любые <b>&lt;meta&gt;</b>-теги для этой страницы (например, Open Graph или Description). <br>
  &lt;!-- Основные SEO-теги --&gt;<br>
  &lt;meta name="description" content=""&gt;<br><br>

  &lt;!-- Open Graph для социальных сетей --&gt;<br>
  &lt;meta property="og:title" content=""&gt;<br>
  &lt;meta property="og:description" content=""&gt;<br>
  &lt;meta property="og:url" content=""&gt;<br>
  &lt;meta property="og:type" content="article"&gt;<br>
  
  </small>
</div>


    <script>



    
    window.onload = async function() {
      // 2) Инициализируем GrapesJS
      const editor = grapesjs.init({
        container: '#gjs',
        height: '700px',
        fromElement: false,
        storageManager: false,
        plugins: [
          'gjs-preset-webpage','grapesjs-code-editor',

          'grapesjs-rte-toolbar-extensions'
        ],
        pluginsOpts: {
          'gjs-preset-webpage': {
            blocksBasicOpts: {
              blocks: ['button']
            }
          }
        },

        canvas: {
          styles: [
            'https://unpkg.com/@picocss/pico@latest/css/pico.min.css'
          ]
        }
      });



      editor.on('load', () => {
        editor.DomComponents.getWrapper().set('droppable', true);
        editor.DomComponents.getWrapper().components().forEach(comp => comp.set({ droppable: true }));

     
      });



      editor.DomComponents.addType('button', {
        extend: 'button',
        isComponent: el => el.tagName === 'BUTTON',
        model: {
          defaults: {
            draggable: '*', // или 'body, [data-gjs-type=container], [data-gjs-type=section], [data-gjs-type=column], [data-gjs-type=grid]'
          }
        }
      });

      const PICO_SNIPPETS = {
        // Grid-контейнеры
        'Grid 2 колонки': '<div class="grid"><section>Секция 1</section><section>Секция 2</section></div>',
        'Grid 3 колонки': '<div class="grid"><section>Секция 1</section><section>Секция 2</section><section>Секция 3</section></div>',
        'Grid 4 колонки': '<div class="grid"><section>1</section><section>2</section><section>3</section><section>4</section></div>',
      
        // Текстовые элементы
        H1: '<h1>Заголовок H1</h1>',
        H2: '<h2>Заголовок H2</h2>',
        H3: '<h3>Заголовок H3</h3>',
        Параграф: '<p>Абзац текста с <a href="#">ссылкой</a>.</p>',
        Blockquote: '<blockquote>Цитата</blockquote>',
        'Код-блок': '<pre><code>Кодовый блок // пример</code></pre>',
        'Inline-код': '<p>Некоторый <code>inline-код()</code> в тексте.</p>',
      
        // Списки
        'Маркированный список': '<ul><li>Пункт 1</li><li>Пункт 2</li></ul>',
        'Нумерованный список': '<ol><li>Первый</li><li>Второй</li></ol>',
        'Task-list': '<ul class="task-list"><li><input type="checkbox"/> Задача 1</li><li><input type="checkbox"/> Задача 2</li></ul>',
      
        // Таблица
        Таблица: '<table><thead><tr><th>Заголовок A</th><th>Заголовок B</th></tr></thead><tbody><tr><td>Ячейка A1</td><td>Ячейка B1</td></tr></tbody></table>',
      
        // Формы
        'Форма простая': '<form><label>Текст<input type="text"/></label><button type="submit">Отправить</button></form>',
        Fieldset: '<fieldset role="group"><input type="email" placeholder="Email"/><button>Подписаться</button></fieldset>',
        Поиск: '<form role="search"><input type="search" placeholder="Поиск"/><button>Найти</button></form>',
        Checkbox: '<input type="checkbox"/> Переключатель (switch)',
        Range: '<input type="range"/> Ползунок',
        Select: '<select><option>Вариант 1</option><option>Вариант 2</option></select>',
        Textarea: '<textarea placeholder="Напишите..."></textarea>',
      
        // Навигация
        Nav: '<nav><ul><li><strong>Logo</strong></li><li><a href="#">Home</a></li></ul></nav>',
        Dropdown: '<details class="dropdown"><summary>Dropdown</summary><ul><li><a href="#">Item 1</a></li></ul></details>',
      
        // Макеты
        Container: '<div class="container"></div>',
        Grid: '<div class="grid"><div>Колонка 1</div><div>Колонка 2</div></div>',
        Group: '<div role="group"><button>1</button><button>2</button></div>',
      
        // Карточки, уведомления и прогресс
        Card: '<article class="card"><h3>Заголовок</h3><p>Контент</p></article>',
        Progress: '<progress max="100" value="40"></progress>',
    
        'Link (contrast)': '<a href="#" class="contrast">Link</a>'
      };
   



      Object.entries(PICO_SNIPPETS).forEach(([id, html]) => {
        editor.BlockManager.add('pico-' + id.toLowerCase(), {
          label: id,
          category: 'Pico Buttons',
          content: {
            tagName: 'div',
            content: html,
            traits: [
              'id',
              'title'
              // можешь добавить другие: { type: 'text', name: 'data-attr', label: 'Атрибут' }
            ]
          },
          activate: true,
          select: true,
          draggable: true,
          attributes: { title: id, class: 'fa fa-square' }
          
        });
      });
  
           const picoButtonTypes = {
          Button:    { tag: 'a', class: 'button', label: 'Button' },
          Primary:   { tag: 'a', class: 'button primary', label: 'Primary' },
          Secondary: { tag: 'a', class: 'button secondary', label: 'Secondary' },
          Contrast:  { tag: 'a', class: 'button contrast', label: 'Contrast' },
          Outline:   { tag: 'a', class: 'button outline', label: 'Outline' },
          Link:      { tag: 'a',      class: 'button primary', label: 'Link (Button)' }
        };
     
      
        Object.entries(picoButtonTypes).forEach(([key, { tag, class: cls, label }]) => {
          // Массив traits: для <a> добавляем href, id, title, для <button> только id, title
          const traits = [
            ...(tag === 'a'
              ? ['href', 'id', 'title']
              : ['id', 'title']),
            {
              type: 'text',
              name: 'text',
              label: 'Текст кнопки',
              changeProp: 1,
            },
          ];
        
          editor.DomComponents.addType('pico-' + key.toLowerCase(), {
            model: {
              defaults: {
                tagName: tag,
                attributes: Object.assign(
                  {
                    class: cls
                  },
                  tag === 'a' ? { href: '#' } : {}
                ),
                traits,
                content: label,
              },
              init() {
                this.on('change:text', () => {
                  this.components(this.get('text'));
                });
              }
            }
          });
        

        // Добавляем кнопку в BlockManager
        editor.BlockManager.add('pico-btn-' + key.toLowerCase(), {
          label,
          category: 'Pico Кнопки',
          content: { type: 'pico-' + key.toLowerCase() }
          
        });
      });
      

      editor.BlockManager.add('dropdown-faq', {
        label: 'FAQ Dropdown',
        category: 'Pico Blocks',
        content: {
          tagName: 'details',
          attributes: { class: 'dropdown', open: '' },
          components: [
            {
              tagName: 'summary',
              content: 'Вопрос (редактируйте тут)'
            },
            {
              tagName: 'div',
              attributes: { 
                class: 'dropdown-answer', 
                contenteditable: 'true',
                style: 'display:block; margin:10px 0 0 0; padding:8px; border:1px solid #ccc;'
              },
              content: 'Ответ (редактируйте тут)'
            }
          ]
        }
      });
      



      // 4) Функции load/save/del теперь внутри
      async function load() {
        const sel = document.getElementById('pageList');
        const slug = sel.value;
        const res  = await fetch('/api/page/'+slug);
        // Правильно деструктурируем ответ:
        const { title='', slug: s='', content='', blocks=[], style = '', seo_meta=''  } = await res.json();
        document.getElementById('title').value = title;
        document.getElementById('slug').value  = s;
        // Собираем HTML из legacy-content или pico-блоков
        const html = content || blocks.map(b=>b.data.html||'').join('');
        editor.setComponents(html);

     

        function setupDropdownToggles(editor) {
          editor.getWrapper().findType('details').forEach(d => {
            if (d.getClasses().includes('dropdown')) {
              d.addAttributes({ open: '' });
        
              // Найдём или добавим dropdown-answer
              let answer = d.components().filter(c =>
                (c.get('tagName') === 'div' && c.getClasses().includes('dropdown-answer'))
                || (c.get('tagName') === 'ul')
              )[0];
              if (!answer) {
                answer = d.append({
                  tagName: 'div',
                  attributes: { class: 'dropdown-answer', contenteditable: 'true', style: 'display:block; margin:10px 0 0 0; padding:8px; border:1px solid #ccc;' },
                  content: 'Ответ (редактируйте тут)'
                });
              } else {
                answer.addAttributes({ contenteditable: 'true', style: 'display:block; margin:10px 0 0 0; padding:8px; border:1px solid #ccc;' });
              }
        
              // Плюсик добавляем если его ещё нет
              if (!d.components().some(c => c.get('tagName') === 'span' && c.getClasses().includes('dropdown-plus'))) {
                d.components().add({
                  tagName: 'span',
                  attributes: {
                    class: 'dropdown-plus',
                    style: 'cursor:pointer;display:inline-block;font-size:1.2em;padding:0 8px;color:#00a;user-select:none;'
                  },
                  content: '+',
                  selectable: false,
                  draggable: false,
                  droppable: false,
                }, { at: 1 }); // Вставляем после summary
              }
            }
          });
        
          // Навесить обработчики (после таймаута для синхронизации с DOM)
          setTimeout(() => {
            document.querySelectorAll('.gjs-selected .dropdown-plus, .dropdown-plus').forEach(plus => {
              plus.onclick = function(e) {
                e.stopPropagation();
                const details = plus.closest('details');
                const answer = details.querySelector('.dropdown-answer, ul');
                if (answer) {
                  answer.style.display = (answer.style.display === 'none' ? 'block' : 'none');
                }
              };
            });
          }, 500);
        }
        
        // после editor.setComponents(html):
        setupDropdownToggles(editor);
        
        // И после editor.on('load', ...):
        editor.on('load', () => {
          setupDropdownToggles(editor);
        });
        


        editor.setStyle(style || '');
        document.getElementById('seo_meta').value = seo_meta || '';
      }


      async function copyPage() {
        const sel = document.getElementById('pageList');
        const slug = sel.value;
        if (!slug) return alert('Нет выбранной страницы!');
        // 1. Грузим данные
        const res = await fetch('/api/page/' + slug);
        if (!res.ok) return alert('Ошибка загрузки');
        const data = await res.json();
      
        // 2. Меняем title и slug
        let newTitle = data.title + ' (КОПИЯ)';
        let newSlug = data.slug + '-copy';
        // Проверяем нет ли уже такого slug
        const allPages = await (await fetch('/api/pages')).json();
        let i = 2;
        while (allPages.some(p => p.slug === newSlug)) {
          newSlug = data.slug + '-copy' + i++;
        }
      
        // 3. Сохраняем как новую страницу
        const body = { ...data, title: newTitle, slug: newSlug };
        // удаляем возможно внутренние ID, если есть
        delete body.id;
        const saveRes = await fetch('/api/page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      
        if (saveRes.ok) {
          alert('Копия создана!');
          await loadPages();
          document.getElementById('pageList').value = newSlug;
        } else {
          alert('Ошибка при копировании');
        }
      }
    
      async function save() {
        const title = document.getElementById('title').value.trim();
        const slug  = document.getElementById('slug').value.trim();
        if (!slug) return alert('Slug не может быть пустым');



        editor.getWrapper().view.render();
        editor.refresh();
        const html = editor.getHtml();
        const css  = editor.getCss();
        const seo_meta = document.getElementById('seo_meta').value;
        const res  = await fetch('/api/page', {
          method: 'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ title, slug, content: html, style: css, seo_meta })
        });
        if (!res.ok) return alert('Ошибка при сохранении: '+res.status);
        alert('Сохранено');
        await loadPages();
      }
    
      async function del() {
        const slug = document.getElementById('pageList').value;
        await fetch('/api/page/'+slug, { method:'DELETE' });
        alert('Удалено');
        await loadPages();
      }
    
      // 5) Загрузка списка страниц
      async function loadPages() {
        const sel = document.getElementById('pageList');
        const prev = sel.value;
        sel.innerHTML = '';
        const list = await (await fetch('/api/pages')).json();
        list.forEach(p=>{
          const opt = document.createElement('option');
          opt.value = p.slug;
          opt.textContent = p.title+' ('+p.slug+')';
          sel.appendChild(opt);
        });
        if (prev) sel.value = prev;
      }
    
      // 6) Навешиваем кнопки
      document.querySelector('button[onclick="load()"]').onclick = load;
      document.getElementById('copy-btn').onclick = copyPage;
      document.querySelector('button[onclick="save()"]').onclick = save;
      document.querySelector('button[onclick="del()"]').onclick  = del;
  
    
      // Наконец
      await loadPages();
    };
    </script>  </div><!-- /.container -->
  </body></html>`, { headers: { "Content-Type": "text/html" } });
}

async function renderMenuEditor(env) {
  const settingsRaw = await env.CMS_KV.get("site:settings");
  const settings = settingsRaw ? JSON.parse(settingsRaw) : { menu: [] };
  const menuData = JSON.stringify(settings.menu || []);
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Редактор меню</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
  <style>
    body   { width: 80%; margin: 2rem auto; }
    ul     { list-style: none; padding-left: 1rem; }
    li     { margin: 0.5rem 0; }
    button { margin-left: 0.5rem; }
  </style>
  </head><body><div class="container">
  <p><a href="/pandora" class="contrast">← Главное меню</a></p>
  <h1>Редактировать меню</h1>
    <ul id="menu"></ul>
    <button onclick="addItem(menu)">➕ Добавить пункт</button>
    <script>
      const menu = ${menuData};
      function renderMenu(list, el, parentPath = []) {
        el.innerHTML = "";         // очищаем контейнер перед рендером, чтобы не дублировать
        list.forEach((item, i) => {
          const path    = [...parentPath, i];          // <-- вот тут
          const pathStr = JSON.stringify(path);
          const li      = document.createElement('li');
          li.innerHTML  =
            item.title + ' <a href="/' + item.slug + '">/' + item.slug + '</a> ' +
            '<button onclick="edit('    + pathStr + ')">✏️</button>' +
            '<button onclick="del('     + pathStr + ')">🗑️</button>' +
            '<button onclick="addChild('+ pathStr + ')">➕</button>';
          if (item.children && item.children.length) {
            const sub = document.createElement('ul');
            renderMenu(item.children, sub, path);  // здесь path уже корректный
            li.appendChild(sub);
          }
          el.appendChild(li);
        });
      }
      function getByPath(obj, path) {
        return path.reduce((acc, i) => acc[i], obj);
      }
      function del(path) {
        const idx    = path.pop();
        const parent = path.length
          ? getByPath(menu, path).children
          : menu;
        parent.splice(idx, 1);
        saveMenu();
      }
      function edit(path) {
        const item  = getByPath(menu, path);
        const title = prompt("Название:", item.title);
        const slug  = prompt("Slug:", item.slug);
        const icon  = prompt("URL иконки:", item.icon||"");
        if (title && slug) {
          item.title = title;
          item.slug  = slug;
          item.icon  = icon;
          saveMenu();
        }
      }
      function addChild(path) {
        const parent = getByPath(menu, path);
        const title  = prompt("Название:");
        const slug   = prompt("Slug:");
        const icon   = prompt("URL иконки:", "");
        if (title && slug) {
          if (!parent.children) parent.children = [];
          parent.children.push({ title, slug, icon, children: [] });
          saveMenu();
        }
      }
      function addItem(target) {
        const title = prompt("Название:");
        const slug  = prompt("Slug:");
        const icon  = prompt("URL иконки:", "");
        if (title && slug) {
          target.push({ title, slug, icon, children: [] });
          saveMenu();
        }
      }
      async function saveMenu() {
        await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(menu)
        });
        location.reload();
      }
      renderMenu(menu, document.getElementById('menu'));
    </script></div><!-- /.container -->
  </body></html>`, { headers: { "Content-Type": "text/html" } });
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

// страница логина
if (pathname === "/pandora/login") {
  if (request.method === "GET")  return renderLogin();
  if (request.method === "POST") return handleLogin(request);
}

// остальные /pandora-маршруты
if (pathname.startsWith("/pandora")) {
  return renderAdmin(request, env, url);
}



    if (pathname === "/api/page" && request.method === "POST") {
      const body = await request.json();
      await env.CMS_KV.put(`page:${body.slug}`, JSON.stringify(body));
      let pages = JSON.parse(await env.CMS_KV.get("pages") || "[]");
      pages = pages.filter(p => p.slug !== body.slug);
      pages.push({ title: body.title, slug: body.slug });
      await env.CMS_KV.put("pages", JSON.stringify(pages));
      return new Response("OK");
    }

    if (pathname.startsWith("/api/page/") && request.method === "GET") {
      const slug = pathname.split("/").pop();
      const raw    = await env.CMS_KV.get(`page:${slug}`);
      const record = raw ? JSON.parse(raw) : {};
    
      // для старых записей с content, но без blocks
      if (!Array.isArray(record.blocks) && record.content) {
        record.blocks = [{
          type: "raw",
          data: { html: record.content }
        }];
      }
    
      return new Response(JSON.stringify(record), {
        headers: { "Content-Type": "application/json" }
      });
    }
    



    if (pathname.startsWith("/api/page/") && request.method === "DELETE") {
      const slug = pathname.split("/").pop();
      await env.CMS_KV.delete(`page:${slug}`);
      let pages = JSON.parse(await env.CMS_KV.get("pages") || "[]");
      pages = pages.filter(p => p.slug !== slug);
      await env.CMS_KV.put("pages", JSON.stringify(pages));
      return new Response("Deleted");
    }

    if (pathname === "/api/pages") {
      const data = await env.CMS_KV.get("pages");
      return new Response(data || "[]", { headers: { "Content-Type": "application/json" } });
    }

    if (pathname === "/api/menu" && request.method === "POST") {
      const menu = await request.json();
      const settingsRaw = await env.CMS_KV.get("site:settings");
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      settings.menu = menu;
      await env.CMS_KV.put("site:settings", JSON.stringify(settings));
      return new Response("OK");
    }

// POST /api/settings — сохраняем logoUrl и footerText
if (pathname === "/api/settings" && request.method === "POST") {
  const {
    logoUrl,
    faviconUrl,
    footerText,
    buttonUrl,
    buttonText,
    enableTrafficFilter
  } = await request.json();

  const raw = await env.CMS_KV.get("site:settings");
  const s = raw ? JSON.parse(raw) : {};
  s.logoUrl    = logoUrl;
  s.faviconUrl = faviconUrl;
  s.footerText = footerText;
  s.buttonUrl  = buttonUrl;
  s.buttonText = buttonText;
  s.enableTrafficFilter = enableTrafficFilter;
  await env.CMS_KV.put("site:settings", JSON.stringify(s));
  return new Response("OK");
}

    // Генерация sitemap.xml
    if (pathname === "/sitemap.xml") {
      const pages = JSON.parse(await env.CMS_KV.get("pages") || "[]");
      const urls = pages.map(p => `<url><loc>https://${url.hostname}/${p.slug}</loc></url>`).join("");
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
        headers: { "Content-Type": "application/xml" }
      });
    }

    // Генерация robots.txt
    if (pathname === "/robots.txt") {
      return new Response(`User-agent: *
Allow: /
Sitemap: https://${url.hostname}/sitemap.xml`, {
        headers: { "Content-Type": "text/plain" }
      });
    }

    return renderPage(env, pathname.replace(/^\//, "") || "home");
  }
};
