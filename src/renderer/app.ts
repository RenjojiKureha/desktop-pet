import { createApp, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import './styles.css';
import type { AppConfig, PetState } from '../shared/types';
import {
  clampEnergy,
  updateMood,
  pickRandom,
  getMessagePool,
  buildPetClass,
  resolvePetEmoji,
  calculateMovePosition,
  formatChimeMessage,
  getNextChimeDelay,
} from '../shared/pet-logic';
import { serializeState, deserializeState } from '../shared/state';
import { getAnimationDuration } from '../shared/config';

const DEFAULT_CONFIG: AppConfig = {
  pet: { name: '大鳐鱼', emoji: '🐟', width: 200, height: 300 },
  skin: {
    enabled: true,
    type: 'emoji',
    customImage: '',
    skins: [{ id: 'default', name: '默认', type: 'emoji', value: '🐟' }],
    currentSkin: 'default',
  },
  clock: {
    enableChime: false,
    chimeHours: [],
    chimeMessage: '现在是 {hour} 点啦！{action}',
    chimeActions: [],
  },
  window: { width: 300, height: 400, initialX: 100, initialY: 100 },
  animations: {
    breatheDuration: 2000,
    jumpDuration: 600,
    happyDuration: 800,
    swayDuration: 3000,
    sleepyDuration: 1500,
    crawlDuration: 800,
  },
  timers: {
    energyDecreaseInterval: 60000,
    idleActionInterval: 8000,
    autoMoveIntervalMin: 15000,
    autoMoveIntervalMax: 30000,
    messageShowDuration: 2000,
  },
  messages: {
    click: ['摸鱼时间到！', '该喝水啦～', '一起加油！', '注意休息哦'],
    idle: ['无聊中...', '该歇歇了', '有什么好玩的？'],
    lowEnergy: ['累啦...', '需要休息', '电量低...'],
    moving: ['走起！', '去那边看看～', '动一动！'],
  },
  moods: {
    happy: ['开心', '兴奋', '满足', '调皮'],
    normal: ['平静', '期待'],
    tired: ['疲惫', '困倦'],
    lowEnergy: '疲惫',
  },
  thresholds: { tiredMood: 30, noAutoMove: 10, canAutoMove: 20 },
};

const DEFAULT_STATE: PetState = {
  energy: 100,
  mood: '开心',
  currentSkin: 'default',
  customImage: '',
  timestamp: 0,
};

const api = window.electronAPI;

const vueApp = createApp({
  setup() {
    // ---- Reactive state ----
    const config = ref<AppConfig>({ ...DEFAULT_CONFIG });
    const currentAnimation = ref('');
    const showMessage = ref(false);
    const message = ref('');
    const energy = ref(100);
    const mood = ref('开心');
    const isHovering = ref(false);
    const isAutoMoving = ref(false);
    const moveDirection = ref('');
    const currentSkin = ref('default');
    const customImage = ref('');

    // ---- Timer refs ----
    const timers: ReturnType<typeof setInterval>[] = [];
    let autoMoveTimeout: ReturnType<typeof setTimeout> | null = null;
    let animationTimeout: ReturnType<typeof setTimeout> | null = null;
    let chimeTimeout: ReturnType<typeof setTimeout> | null = null;
    // Queue for sequential animations (fixes bug #5)
    let animationQueue: string[] = [];
    let animationPlaying = false;

    // ---- Computed ----
    const petEmoji = computed(() => {
      if (customImage.value) return '';
      return resolvePetEmoji(config.value.skin, currentSkin.value, config.value.pet.emoji);
    });

    const petClass = computed(() =>
      buildPetClass({
        currentAnimation: currentAnimation.value,
        energy: energy.value,
        isHovering: isHovering.value,
        isAutoMoving: isAutoMoving.value,
        moveDirection: moveDirection.value,
        thresholds: config.value.thresholds,
      })
    );

    // ---- Methods ----

    async function loadConfig() {
      try {
        const response = await fetch('./config.json');
        const data = await response.json();
        config.value = { ...DEFAULT_CONFIG, ...data };
      } catch {
        config.value = { ...DEFAULT_CONFIG };
      }
    }

    async function loadSavedState() {
      try {
        const raw = await api.loadState();
        const state = deserializeState(raw, DEFAULT_STATE);
        energy.value = state.energy;
        mood.value = state.mood;
        currentSkin.value = state.currentSkin;
        customImage.value = state.customImage;
      } catch {
        // Use defaults
      }
    }

    function doSaveState() {
      const state = serializeState({
        energy: energy.value,
        mood: mood.value,
        currentSkin: currentSkin.value,
        customImage: customImage.value,
        timestamp: Date.now(),
      });
      api.saveState(state);
    }

    function setupCSSVariables() {
      const anims = config.value.animations;
      const s = document.body.style;
      s.setProperty('--breathe-duration', `${anims.breatheDuration}ms`);
      s.setProperty('--jump-duration', `${anims.jumpDuration}ms`);
      s.setProperty('--happy-duration', `${anims.happyDuration}ms`);
      s.setProperty('--sway-duration', `${anims.swayDuration}ms`);
      s.setProperty('--sleepy-duration', `${anims.sleepyDuration}ms`);
      s.setProperty('--crawl-duration', `${anims.crawlDuration}ms`);
    }

    /** Play animation with proper queuing (fixes bug #5). */
    function playAnimation(animName: string) {
      animationQueue.push(animName);
      if (!animationPlaying) {
        playNextAnimation();
      }
    }

    function playNextAnimation() {
      if (animationQueue.length === 0) {
        animationPlaying = false;
        currentAnimation.value = '';
        return;
      }
      animationPlaying = true;
      const animName = animationQueue.shift()!;
      currentAnimation.value = animName;

      if (animationTimeout) clearTimeout(animationTimeout);

      const duration = getAnimationDuration(config.value.animations, animName);
      animationTimeout = setTimeout(() => {
        playNextAnimation();
      }, duration);
    }

    function doUpdateMood() {
      mood.value = updateMood(energy.value, config.value.thresholds, config.value.moods);
    }

    function showRandomMessage(type: 'click' | 'idle' | 'moving' | 'lowEnergy' | 'all') {
      const pool = getMessagePool(type, config.value.messages);
      if (pool.length === 0) return;
      message.value = pickRandom(pool) ?? '';
      showMessage.value = true;
      setTimeout(() => {
        showMessage.value = false;
      }, config.value.timers.messageShowDuration);
    }

    // ---- Event handlers (bound to template) ----

    function petClick() {
      // Queue jumping then happy (fixes bug #5: both animations play sequentially)
      playAnimation('jumping');
      playAnimation('happy');

      energy.value = clampEnergy(energy.value, 5);
      doUpdateMood();
      doSaveState();
      showRandomMessage('click');
    }

    function petHover() {
      // Visual effects handled by CSS :hover
    }

    function handleMouseEnter() {
      isHovering.value = true;
      if (autoMoveTimeout) {
        clearTimeout(autoMoveTimeout);
        autoMoveTimeout = null;
      }
    }

    function handleMouseLeave() {
      isHovering.value = false;
      if (energy.value > config.value.thresholds.canAutoMove) {
        startAutoMove();
      }
    }

    function closeApp() {
      doSaveState();
      api.closeApp();
    }

    // ---- Auto-move (fixes bug #7: uses setTimeout consistently) ----

    function startAutoMove() {
      if (autoMoveTimeout) {
        clearTimeout(autoMoveTimeout);
        autoMoveTimeout = null;
      }

      if (energy.value <= config.value.thresholds.canAutoMove) return;

      const scheduleNext = () => {
        const min = config.value.timers.autoMoveIntervalMin;
        const max = config.value.timers.autoMoveIntervalMax;
        const delay = Math.random() * (max - min) + min;

        autoMoveTimeout = setTimeout(() => {
          if (!isHovering.value && energy.value > config.value.thresholds.canAutoMove) {
            triggerAutoMove();
          }
          scheduleNext();
        }, delay);
      };

      scheduleNext();
    }

    async function triggerAutoMove() {
      isAutoMoving.value = true;
      const direction = Math.random() > 0.5 ? 'right' : 'left';
      moveDirection.value = direction === 'right' ? '向右' : '向左';
      showRandomMessage('moving');

      try {
        const { width: screenWidth } = await api.getScreenSize();
        const { x: currentX, y: currentY } = await api.getWindowPosition();
        const newX = calculateMovePosition(
          currentX,
          direction,
          screenWidth,
          config.value.window.width
        );
        api.moveWindow(newX, currentY);
      } catch {
        // Ignore move errors
      }

      setTimeout(() => {
        isAutoMoving.value = false;
        moveDirection.value = '';
      }, 800);
    }

    // ---- Timers ----

    function startTimers() {
      // Energy decrease
      const energyTimer = setInterval(() => {
        if (energy.value > 0) {
          energy.value = clampEnergy(energy.value, -1);
          doUpdateMood();
          doSaveState();
        }
      }, config.value.timers.energyDecreaseInterval);
      timers.push(energyTimer);

      // Idle actions
      const idleTimer = setInterval(() => {
        if (energy.value > config.value.thresholds.canAutoMove) {
          const actions = ['happy', 'swaying'];
          playAnimation(pickRandom(actions) ?? 'happy');
        }
      }, config.value.timers.idleActionInterval);
      timers.push(idleTimer);

      // Auto move
      startAutoMove();
    }

    function clearAllTimers() {
      timers.forEach(t => clearInterval(t));
      timers.length = 0;
      if (autoMoveTimeout) {
        clearTimeout(autoMoveTimeout);
        autoMoveTimeout = null;
      }
      if (animationTimeout) {
        clearTimeout(animationTimeout);
        animationTimeout = null;
      }
      if (chimeTimeout) {
        clearTimeout(chimeTimeout);
        chimeTimeout = null;
      }
      animationQueue = [];
      animationPlaying = false;
    }

    // ---- Clock chime (fixes bug #16: setTimeout chain instead of 1s polling) ----

    function startClock() {
      if (!config.value.clock.enableChime) return;

      const scheduleChime = () => {
        const now = new Date();
        const delay = getNextChimeDelay(now, config.value.clock.chimeHours);
        if (delay === null) return;

        chimeTimeout = setTimeout(() => {
          const chimeNow = new Date();
          const hour = chimeNow.getHours();
          chimeHour(hour);
          scheduleChime();
        }, delay);
      };

      scheduleChime();
    }

    function chimeHour(hour: number) {
      const actions = config.value.clock.chimeActions;
      const action = pickRandom(actions) ?? '';
      const template = config.value.clock.chimeMessage;
      message.value = formatChimeMessage(template, hour, action);
      showMessage.value = true;
      playAnimation('happy');
      setTimeout(() => {
        showMessage.value = false;
      }, 4000);
    }

    // ---- IPC listeners ----

    function setupIpcListeners() {
      api.onChangeSkin((skinId: string) => {
        currentSkin.value = skinId;
        customImage.value = '';
        playAnimation('happy');
        const skin = config.value.skin.skins.find(s => s.id === skinId);
        message.value = skin ? `已切换为 ${skin.name}` : '衣橱切换成功';
        showMessage.value = true;
        setTimeout(() => {
          showMessage.value = false;
        }, 2000);
        doSaveState();
      });

      api.onLoadCustomSkin(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: Event) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = evt => {
              customImage.value = (evt.target as FileReader).result as string;
              playAnimation('happy');
              message.value = '皮肤加载成功！';
              showMessage.value = true;
              setTimeout(() => {
                showMessage.value = false;
              }, 2000);
              doSaveState();
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      });

      api.onRefreshState(() => {
        showRandomMessage('idle');
        playAnimation('happy');
      });

      api.onShowInfo(() => {
        message.value = `名称：${config.value.pet.name}\n心情：${mood.value}\n能量：${energy.value}%`;
        showMessage.value = true;
        setTimeout(() => {
          showMessage.value = false;
        }, 3000);
      });

      api.onSaveOnExit(() => {
        doSaveState();
        // Notify main process that save is complete (fixes bug #8)
        api.notifySaveComplete();
      });
    }

    function cleanupIpcListeners() {
      const channels = [
        'change-skin',
        'load-custom-skin',
        'refresh-state',
        'show-info',
        'save-on-exit',
      ];
      channels.forEach(ch => api.removeAllListeners(ch));
    }

    function setupContextMenu() {
      window.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        api.showContextMenu();
      });
    }

    // ---- Lifecycle ----

    onMounted(async () => {
      await loadConfig();
      await loadSavedState();
      setupCSSVariables();
      setupIpcListeners();
      startTimers();
      setupContextMenu();
      startClock();
    });

    onBeforeUnmount(() => {
      clearAllTimers();
      cleanupIpcListeners();
    });

    return {
      message,
      showMessage,
      energy,
      mood,
      isAutoMoving,
      moveDirection,
      petEmoji,
      petClass,
      petClick,
      petHover,
      handleMouseEnter,
      handleMouseLeave,
      closeApp,
    };
  },
});

vueApp.mount('#app');
