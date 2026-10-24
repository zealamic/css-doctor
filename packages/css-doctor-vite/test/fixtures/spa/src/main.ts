import './style.css';

const app = document.querySelector<HTMLElement>('#app');

if (app) {
  app.className = 'shell';
  app.textContent = 'Loading…';
}

const routes = {
  home: () => import('./pages/home'),
  about: () => import('./pages/about'),
};

const requested = new URLSearchParams(window.location.search).get(
  'route',
);

if (requested === 'about') {
  void routes.about();
} else {
  void routes.home();
}
