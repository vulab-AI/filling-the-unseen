'use strict';

// Two original camera trajectories, sharing one elapsed-time playback clock.
// Shorter clips hold their last frame; no speed changes or frame interpolation.
(() => {
  const gallery = document.querySelector('#scene-videos');
  if (!gallery) return;
  const $ = selector => gallery.querySelector(selector);
  const $$ = selector => [...gallery.querySelectorAll(selector)];
  const videos = [$('#clip-baseline-video'), $('#clip-ours-video')];
  const playButton = $('#clip-play');
  const restartButton = $('#clip-restart');
  const progress = $('#clip-progress');
  const status = $('#clip-status');
  let scenes, scene, clips, clock, duration = 5;
  let loadRequest = 0, playbackRequest = 0, frame = 0, playing = false, loading;

  function updateProgress() {
    const time = Math.min(clock?.currentTime || 0, duration);
    progress.value = Math.round(time / duration * 1000);
    progress.setAttribute('aria-valuetext', `${time.toFixed(1)} of ${duration.toFixed(1)} seconds`);
    $('#clip-time').textContent = `${time.toFixed(1)} / ${duration.toFixed(1)} s`;
  }

  function pause() {
    ++playbackRequest;
    playing = false;
    cancelAnimationFrame(frame);
    videos.forEach(video => video.pause());
    playButton.textContent = 'Play comparison';
    updateProgress();
  }

  function seek(time) {
    videos.forEach((video, index) => {
      if (video.readyState >= 1) video.currentTime = Math.min(time, clips[index].duration);
    });
    updateProgress();
  }

  function tick() {
    if (!playing) return;
    updateProgress();
    if (clock.ended || clock.currentTime >= duration) {
      pause();
      return;
    }
    for (let index = 0; index < videos.length; index++) {
      const video = videos[index];
      if (video === clock || video.seeking) continue;
      const target = Math.min(clock.currentTime, clips[index].duration);
      if (Math.abs(video.currentTime - target) > .12) video.currentTime = target;
    }
    frame = requestAnimationFrame(tick);
  }

  async function play() {
    if (playButton.disabled) return;
    if (clock.ended || clock.currentTime >= duration - .03) seek(0);
    const request = ++playbackRequest;
    playing = true;
    playButton.textContent = 'Pause comparison';
    status.textContent = '';
    try {
      await Promise.all(videos.map((video, index) => {
        if (video.currentTime < clips[index].duration - .02) return video.play();
      }));
      if (request !== playbackRequest) return;
      tick();
    } catch (error) {
      if (request !== playbackRequest) return;
      pause();
      if (error.name !== 'AbortError') status.textContent = 'Playback could not start. Try Play comparison again or download the clips.';
    }
  }

  function ready(video, signal) {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', loaded);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', aborted);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Video could not load')); };
      const aborted = () => { cleanup(); reject(new DOMException('Scene changed', 'AbortError')); };
      const timeout = setTimeout(failed, 30000);
      video.addEventListener('loadeddata', loaded);
      video.addEventListener('error', failed);
      signal.addEventListener('abort', aborted, { once: true });
    });
  }

  async function loadScene() {
    const request = ++loadRequest;
    loading?.abort();
    loading = new AbortController();
    pause();
    gallery.setAttribute('aria-busy', 'true');
    playButton.disabled = restartButton.disabled = progress.disabled = true;
    status.textContent = 'Loading clips…';
    const hasRefinement = Boolean(scene.clips.ours_difixed);
    $('#clip-output-control').hidden = !hasRefinement;
    if (!hasRefinement) $('#clip-output').value = 'ours';
    const method = $('#clip-baseline').value;
    const output = $('#clip-output').value;
    clips = [scene.clips[method], scene.clips[output]];
    duration = Math.max(...clips.map(clip => clip.duration));
    clock = videos[clips.findIndex(clip => clip.duration === duration)];
    $('#clip-processing-note').hidden = output !== 'ours_difixed';
    $$('[data-clip-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.clipScene === scene.id)));
    $$('.clip-scene-caption').forEach(caption => { caption.textContent = `${scene.title} · ${scene.dataset}`; });
    videos.forEach((video, index) => {
      const clip = clips[index];
      const side = index ? 'ours' : 'baseline';
      $(`#clip-${side}-heading`).textContent = clip.label;
      $(`#clip-${side}-download`).href = clip.src;
      video.querySelector('a').href = clip.src;
      video.querySelector('a').textContent = `Download ${scene.title}: ${clip.label}`;
      video.setAttribute('aria-label', `${scene.title}: ${clip.label}`);
      video.controls = false;
      video.muted = true;
      video.preload = 'auto';
      video.poster = clip.poster;
      video.src = clip.src;
      video.load();
    });
    updateProgress();
    try {
      await Promise.all(videos.map(video => ready(video, loading.signal)));
      if (request !== loadRequest) return;
      playButton.disabled = restartButton.disabled = progress.disabled = false;
      status.textContent = '';
    } catch (error) {
      if (request !== loadRequest || error.name === 'AbortError') return;
      status.textContent = 'Could not load this comparison. Try another scene or use the download links.';
      videos.forEach(video => { video.controls = true; });
    } finally {
      if (request === loadRequest) gallery.removeAttribute('aria-busy');
    }
  }

  async function initialize() {
    try {
      const response = await fetch('assets/video/presentation/manifest.json');
      if (!response.ok) throw new Error('Missing video manifest');
      ({ scenes } = await response.json());
      scene = scenes[0];
      $('#clip-scenes').hidden = $('#clip-baseline-control').hidden = $('#clip-playback').hidden = false;
      $$('[data-clip-scene]').forEach(button => button.addEventListener('click', () => {
        scene = scenes.find(item => item.id === button.dataset.clipScene);
        loadScene();
      }));
      $('#clip-baseline').addEventListener('change', loadScene);
      $('#clip-output').addEventListener('change', loadScene);
      playButton.addEventListener('click', () => playing ? pause() : play());
      restartButton.addEventListener('click', () => { pause(); seek(0); play(); });
      progress.addEventListener('input', () => {
        const time = Number(progress.value) / 1000 * duration;
        pause();
        seek(time);
      });
      // Do not keep decoding media when the viewer leaves this section or tab.
      document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
          if (!entries[0].isIntersecting && playing) pause();
        }).observe(gallery);
      }
      await loadScene();
    } catch {
      status.textContent = 'Scene selection is unavailable. You can still play or download the Bonsai clips above.';
      videos.forEach(video => { video.controls = true; });
    }
  }
  initialize();
})();
