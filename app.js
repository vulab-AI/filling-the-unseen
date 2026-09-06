'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const config = window.SITE_CONFIG || {};

$$('[data-resource]').forEach(link => {
  const url = config[link.dataset.resource];
  if (url) { link.href = url; link.hidden = false; }
});
if (config.repository) $('[data-site-source]').href = config.repository;

// Native range inputs support mouse, touch, and keyboard interaction.
function updateSplit(compare) {
  const range = $('.compare-range', compare);
  const value = Number(range.value);
  compare.style.setProperty('--split', `${value}%`);
  const before = $('.before-label', compare).textContent.trim();
  range.setAttribute('aria-valuetext', `${value}% ${before}, ${100 - value}% our method`);
}
$$('[data-compare]').forEach(compare => {
  $('.compare-range', compare).addEventListener('input', () => updateSplit(compare));
  updateSplit(compare);
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

let heroRequest = 0;
$$('[data-hero]').forEach(button => {
  button.addEventListener('click', async () => {
    const request = ++heroRequest;
    const scene = button.dataset.hero;
    const before = `assets/results/teaser-${scene}-original.jpg`;
    const after = `assets/results/teaser-${scene}-ours.jpg`;
    try {
      await Promise.all([loadImage(before), loadImage(after)]);
      if (request !== heroRequest) return;
      $('#hero-before').src = before;
      $('#hero-after').src = after;
      $('#hero-before').alt = `${button.textContent.trim()}: original 3DGS rendering with missing regions and artifacts.`;
      $('#hero-after').alt = `${button.textContent.trim()}: Filling the Unseen completes missing regions and refines the scene.`;
      $$('[data-hero]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    } catch (error) { console.error(error); }
  });
});

const labels = {
  original: 'Original 3DGS', genfusion: 'GenFusion', fsgs: 'Few-Shot GS',
  guidedvd: 'Guidedvd-3dgs', difix: 'DiFix3D+', gt: 'Ground truth', ours: 'Ours',
};
const scenes = {
  bonsai: { title: 'Bonsai', dataset: 'Mip-NeRF 360', prefix: 'bonsai', views: [1, 2, 3, 4, 5], methods: ['original', 'genfusion', 'fsgs', 'guidedvd'], figure: 'bonsai' },
  garden: { title: 'Garden', dataset: 'Mip-NeRF 360', prefix: 'garden', views: [1, 2, 3, 4], methods: ['original', 'genfusion', 'fsgs', 'difix', 'guidedvd'], figure: 'garden' },
  workshop: { title: 'Workshop', dataset: 'ScanNet++', prefix: 'scannet', views: [1, 2], methods: ['original', 'genfusion', 'difix', 'guidedvd', 'gt'], figure: 'scannet' },
  meeting: { title: 'Meeting room', dataset: 'ScanNet++', prefix: 'scannet', views: [3, 4], methods: ['original', 'genfusion', 'difix', 'guidedvd', 'gt'], figure: 'scannet' },
};
const state = { scene: 'bonsai', view: 0, method: 'genfusion' };
let resultRequest = 0;
function resultPath(scene, method, view) { return `assets/results/${scene.prefix}-${method}-${scene.views[view]}.jpg`; }

function renderControls() {
  const scene = scenes[state.scene];
  const select = $('#baseline');
  select.replaceChildren(...scene.methods.map(method => {
    const option = document.createElement('option');
    option.value = method;
    option.textContent = labels[method];
    return option;
  }));
  select.value = state.method;
  $('#view-buttons').replaceChildren(...scene.views.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = index + 1;
    button.setAttribute('aria-label', `${scene.title}, view ${index + 1}`);
    button.setAttribute('aria-pressed', String(index === state.view));
    button.addEventListener('click', () => {
      state.view = index;
      $$('#view-buttons button').forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
      renderResults();
    });
    return button;
  }));
}

async function renderResults() {
  const request = ++resultRequest;
  const scene = scenes[state.scene];
  const method = state.method;
  const view = state.view;
  const before = resultPath(scene, method, view);
  const after = resultPath(scene, 'ours', view);
  const compare = $('.result-compare');
  compare.setAttribute('aria-busy', 'true');
  try {
    await Promise.all([loadImage(before), loadImage(after)]);
    if (request !== resultRequest) return;
    $('#result-before').src = before;
    $('#result-after').src = after;
    $('#result-before').alt = `${scene.title}, view ${view + 1}: ${labels[method]}.`;
    $('#result-after').alt = `${scene.title}, view ${view + 1}: Filling the Unseen.`;
    $('#result-before-label').textContent = labels[method];
    $('.compare-range', compare).setAttribute('aria-label', `Compare ${labels[method]} with our method on ${scene.title}`);
    updateSplit(compare);
    $('#result-caption').textContent = `${scene.title} · ${scene.dataset} · View ${view + 1}`;
    $('#full-comparison').href = `assets/figures/${scene.figure}-comparison.pdf`;
    $('#method-strip').replaceChildren(...[...scene.methods, 'ours'].map(key => {
      const card = document.createElement(key === 'ours' ? 'div' : 'button');
      card.className = `method-thumb${key === 'ours' ? ' ours-thumb' : ''}`;
      if (key !== 'ours') {
        card.type = 'button';
        card.setAttribute('aria-pressed', String(key === method));
        card.setAttribute('aria-label', `Compare ${labels[key]} with our method`);
        card.addEventListener('click', () => {
          state.method = key;
          $('#baseline').value = key;
          renderResults();
          $('#baseline').focus({ preventScroll: true });
        });
      }
      const image = document.createElement('img');
      image.src = resultPath(scene, key, view);
      image.width = 480;
      image.height = 270;
      image.alt = `${scene.title}: ${labels[key]}`;
      image.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = labels[key];
      card.append(image, label);
      return card;
    }));
  } catch (error) {
    if (request === resultRequest) $('#result-caption').textContent = 'This comparison could not load. Please try another view.';
    console.error(error);
  } finally {
    if (request === resultRequest) compare.removeAttribute('aria-busy');
  }
}
$$('[data-scene]').forEach(button => {
  button.addEventListener('click', () => {
    state.scene = button.dataset.scene;
    state.view = 0;
    if (!scenes[state.scene].methods.includes(state.method)) state.method = 'genfusion';
    $$('[data-scene]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderControls();
    renderResults();
  });
});
$('#baseline').addEventListener('change', event => { state.method = event.target.value; renderResults(); });
renderControls();
renderResults();

const tabs = $$('[role="tab"]');
function selectTab(tab) {
  tabs.forEach(item => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs.at(-1);
    if (next) { event.preventDefault(); selectTab(next); next.focus(); }
  });
});

const dialog = $('#figure-dialog');
$$('[data-lightbox]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    $('#dialog-image').src = link.dataset.lightbox;
    $('#dialog-image').alt = $('img', link).alt;
    $('#dialog-caption').textContent = link.dataset.caption;
    $('#dialog-pdf').href = link.href;
    dialog.showModal();
  });
});
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

$('#copy-citation').addEventListener('click', async () => {
  const text = $('#bibtex').textContent.trim();
  try {
    await navigator.clipboard.writeText(text);
    $('#copy-status').textContent = 'BibTeX copied to clipboard.';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#bibtex'));
    selection.removeAllRanges();
    selection.addRange(range);
    $('#copy-status').textContent = 'Citation selected. Press Ctrl+C or ⌘C to copy.';
  }
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      $$('.nav-links a').forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
  ['overview', 'results', 'method', 'citation'].forEach(id => observer.observe(document.getElementById(id)));
}
