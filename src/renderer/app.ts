import { createApp, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import './styles.css';
import type { AppConfig, PetState } from '../shared/types';
import {
  clampEnergy,
  updateMood,
  pickRandom,
  getMessagePool,
  getChatButtonLabel,
  buildPetClass,
  resolvePetDisplay,
  calculateMovePosition,
  formatChimeMessage,
  getNextChimeDelay,
  getChimePresetHours,
  parseCountdownInput,
  formatCountdownDisplay,
  parseCustomHoursInput,
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
  chimeEnabled: true,
  chimeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  chimeMessage: '',
  soundEnabled: true,
  soundPreset: 'dingdong',
  customSound: '',
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
    let countdownTimeout: ReturnType<typeof setTimeout> | null = null;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    // Queue for sequential animations (fixes bug #5)
    let animationQueue: string[] = [];
    let animationPlaying = false;

    // ---- Countdown state ----
    const countdownEndTime = ref<number | null>(null);
    const countdownDisplay = ref('');

    // ---- Sound state ----
    const soundEnabled = ref(true);
    const soundPreset = ref('dingdong');
    const customSound = ref('');

    // ---- Prompt dialog state ----
    const promptVisible = ref(false);
    const promptTitle = ref('');
    const promptPlaceholder = ref('');
    const promptValue = ref('');
    let promptResolve: ((value: string | null) => void) | null = null;

    // ---- Computed ----
    const petDisplay = computed(() =>
      resolvePetDisplay(
        config.value.skin,
        currentSkin.value,
        config.value.pet.emoji,
        customImage.value
      )
    );

    const petEmoji = computed(() => {
      const d = petDisplay.value;
      return d.type === 'emoji' ? d.value : '';
    });

    const petImageSrc = computed(() => {
      const d = petDisplay.value;
      return d.type === 'image' ? d.src : '';
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

    const chatLabel = computed(() => getChatButtonLabel(energy.value, config.value.thresholds));

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
        // Restore chime settings into runtime config
        config.value.clock.enableChime = state.chimeEnabled;
        config.value.clock.chimeHours = state.chimeHours;
        if (state.chimeMessage) {
          config.value.clock.chimeMessage = state.chimeMessage;
        }
        // Restore sound settings
        soundEnabled.value = state.soundEnabled;
        soundPreset.value = state.soundPreset;
        customSound.value = state.customSound;
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
        chimeEnabled: config.value.clock.enableChime,
        chimeHours: config.value.clock.chimeHours,
        chimeMessage: config.value.clock.chimeMessage,
        soundEnabled: soundEnabled.value,
        soundPreset: soundPreset.value,
        customSound: customSound.value,
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

    function chatClick() {
      playAnimation('jumping');
      showRandomMessage('chat');
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

    // ---- JS-based drag (replaces -webkit-app-region: drag on handle) ----
    let dragStart = { mouseX: 0, mouseY: 0, winX: 0, winY: 0 };

    function onDragMove(e: MouseEvent) {
      api.moveWindow(
        dragStart.winX + e.screenX - dragStart.mouseX,
        dragStart.winY + e.screenY - dragStart.mouseY
      );
    }

    function onDragEnd() {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
    }

    async function dragHandleMouseDown(e: MouseEvent) {
      e.preventDefault();
      const pos = await api.getWindowPosition();
      dragStart = { mouseX: e.screenX, mouseY: e.screenY, winX: pos.x, winY: pos.y };
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
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
      if (countdownTimeout) {
        clearTimeout(countdownTimeout);
        countdownTimeout = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
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
      playAlertSound();
      setTimeout(() => {
        showMessage.value = false;
      }, 4000);
    }

    // ---- Chime controls ----

    function toggleChime() {
      config.value.clock.enableChime = !config.value.clock.enableChime;
      if (config.value.clock.enableChime) {
        startClock();
        message.value = '报时已开启';
      } else {
        if (chimeTimeout) {
          clearTimeout(chimeTimeout);
          chimeTimeout = null;
        }
        message.value = '报时已关闭';
      }
      showMessage.value = true;
      setTimeout(() => {
        showMessage.value = false;
      }, 2000);
      api.notifyChimeState(config.value.clock.enableChime);
      doSaveState();
    }

    function setChimeHours(preset: string) {
      const hours = getChimePresetHours(preset);
      if (hours.length === 0) return;
      config.value.clock.chimeHours = hours;
      // Restart clock with new hours
      if (chimeTimeout) {
        clearTimeout(chimeTimeout);
        chimeTimeout = null;
      }
      if (config.value.clock.enableChime) {
        startClock();
      }
      const labels: Record<string, string> = {
        work: '工作时间 (9-18点)',
        daytime: '白天 (8-22点)',
        allday: '全天整点',
      };
      message.value = `报时时段: ${labels[preset] ?? preset}`;
      showMessage.value = true;
      setTimeout(() => {
        showMessage.value = false;
      }, 2000);
      doSaveState();
    }

    function setChimeMessage(msg: string) {
      config.value.clock.chimeMessage = msg || '现在是 {hour} 点啦！{action}';
      message.value = msg ? '报时消息已更新' : '已恢复默认消息';
      showMessage.value = true;
      setTimeout(() => {
        showMessage.value = false;
      }, 2000);
      doSaveState();
    }

    // ---- Countdown ----

    function startCountdown(minutes: number) {
      // Clear any existing countdown
      cancelCountdown();

      const durationMs = minutes * 60 * 1000;
      countdownEndTime.value = Date.now() + durationMs;
      api.notifyCountdownState(true);

      message.value = `倒计时 ${minutes} 分钟开始！`;
      showMessage.value = true;
      setTimeout(() => {
        showMessage.value = false;
      }, 2000);

      // Update display every second
      countdownInterval = setInterval(() => {
        if (countdownEndTime.value === null) return;
        const remaining = countdownEndTime.value - Date.now();
        if (remaining <= 0) {
          countdownFinished();
        } else {
          countdownDisplay.value = formatCountdownDisplay(remaining);
        }
      }, 1000);

      // Set exact timeout for completion
      countdownTimeout = setTimeout(() => {
        countdownFinished();
      }, durationMs);
    }

    function countdownFinished() {
      countdownEndTime.value = null;
      countdownDisplay.value = '';
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      if (countdownTimeout) {
        clearTimeout(countdownTimeout);
        countdownTimeout = null;
      }
      api.notifyCountdownState(false);

      // Show alert
      message.value = '倒计时结束！';
      showMessage.value = true;
      playAnimation('jumping');
      playAnimation('happy');
      playAlertSound();
      setTimeout(() => {
        showMessage.value = false;
      }, 5000);
    }

    function cancelCountdown() {
      if (countdownEndTime.value === null) return;
      countdownEndTime.value = null;
      countdownDisplay.value = '';
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      if (countdownTimeout) {
        clearTimeout(countdownTimeout);
        countdownTimeout = null;
      }
      api.notifyCountdownState(false);

      message.value = '倒计时已取消';
      showMessage.value = true;
      setTimeout(() => {
        showMessage.value = false;
      }, 2000);
    }

    // ---- In-app prompt dialog ----

    function showPrompt(title: string, placeholder: string): Promise<string | null> {
      return new Promise(resolve => {
        promptTitle.value = title;
        promptPlaceholder.value = placeholder;
        promptValue.value = '';
        promptVisible.value = true;
        promptResolve = resolve;
        // Focus the input on next tick
        setTimeout(() => {
          const el = document.querySelector('.prompt-input') as HTMLInputElement;
          el?.focus();
        }, 50);
      });
    }

    function promptConfirm() {
      const value = promptValue.value;
      promptVisible.value = false;
      if (promptResolve) {
        promptResolve(value);
        promptResolve = null;
      }
    }

    function promptCancel() {
      promptVisible.value = false;
      if (promptResolve) {
        promptResolve(null);
        promptResolve = null;
      }
    }

    // ---- Sound playback (Web Audio API) ----

    let audioContext: AudioContext | null = null;

    function getAudioContext(): AudioContext {
      if (!audioContext) {
        audioContext = new AudioContext();
      }
      return audioContext;
    }

    function playPresetSound(preset: string) {
      const ctx = getAudioContext();
      switch (preset) {
        case 'dingdong': {
          // Two-tone chime: C5 then E5
          playTone(ctx, 523, 0.2, 0);
          playTone(ctx, 659, 0.3, 0.2);
          break;
        }
        case 'beep': {
          // Two short beeps
          playTone(ctx, 800, 0.1, 0);
          playTone(ctx, 800, 0.1, 0.15);
          break;
        }
        case 'bell': {
          // Higher pitched bell ring
          playTone(ctx, 1047, 0.4, 0);
          break;
        }
        case 'notification': {
          // Ascending three-tone
          playTone(ctx, 523, 0.12, 0);
          playTone(ctx, 659, 0.12, 0.12);
          playTone(ctx, 784, 0.2, 0.24);
          break;
        }
      }
    }

    function playTone(ctx: AudioContext, freq: number, duration: number, delay: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const startTime = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    function playCustomSound(dataUrl: string) {
      const audio = new Audio(dataUrl);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }

    function playAlertSound() {
      if (!soundEnabled.value) return;
      if (customSound.value) {
        playCustomSound(customSound.value);
      } else {
        playPresetSound(soundPreset.value);
      }
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

      // ---- Chime IPC ----
      api.onToggleChime(() => {
        toggleChime();
      });

      api.onSetChimeHours((preset: string) => {
        setChimeHours(preset);
      });

      api.onSetChimeMessage((msg: string) => {
        setChimeMessage(msg);
      });

      api.onPromptChimeHours(async () => {
        const input = await showPrompt(
          '请输入报时小时数，用逗号分隔（0-23）\n例如: 9,12,15,18',
          '9,12,15,18'
        );
        if (input === null) return;
        const hours = parseCustomHoursInput(input);
        if (hours === null) {
          message.value = '输入无效，请使用逗号分隔的小时数';
          showMessage.value = true;
          setTimeout(() => {
            showMessage.value = false;
          }, 2000);
          return;
        }
        config.value.clock.chimeHours = hours;
        if (chimeTimeout) {
          clearTimeout(chimeTimeout);
          chimeTimeout = null;
        }
        if (config.value.clock.enableChime) {
          startClock();
        }
        message.value = `报时时段已设置: ${hours.join(', ')}点`;
        showMessage.value = true;
        setTimeout(() => {
          showMessage.value = false;
        }, 2000);
        doSaveState();
      });

      api.onPromptChimeMessage(async () => {
        const input = await showPrompt(
          '请输入自定义报时消息\n可用变量: {hour} {period} {action}\n留空恢复默认',
          '现在是 {hour} 点啦！{action}'
        );
        if (input === null) return;
        setChimeMessage(input);
      });

      // ---- Countdown IPC ----
      api.onStartCountdown((minutes: number) => {
        startCountdown(minutes);
      });

      api.onCancelCountdown(() => {
        cancelCountdown();
      });

      api.onPromptCountdown(async () => {
        const input = await showPrompt('请输入倒计时分钟数（1-120）', '25');
        if (input === null) return;
        const minutes = parseCountdownInput(input);
        if (minutes === null) {
          message.value = '输入无效，请输入1-120之间的数字';
          showMessage.value = true;
          setTimeout(() => {
            showMessage.value = false;
          }, 2000);
          return;
        }
        startCountdown(minutes);
      });

      // ---- Sound IPC ----
      api.onToggleSound(() => {
        soundEnabled.value = !soundEnabled.value;
        message.value = soundEnabled.value ? '音效已开启' : '音效已关闭';
        showMessage.value = true;
        setTimeout(() => {
          showMessage.value = false;
        }, 2000);
        api.notifySoundState(soundEnabled.value);
        doSaveState();
      });

      api.onSetSoundPreset((preset: string) => {
        soundPreset.value = preset;
        customSound.value = '';
        const names: Record<string, string> = {
          dingdong: '叮咚',
          beep: '滴滴',
          bell: '铃声',
          notification: '提示音',
        };
        message.value = `音效: ${names[preset] ?? preset}`;
        showMessage.value = true;
        setTimeout(() => {
          showMessage.value = false;
        }, 2000);
        // Preview the sound
        if (soundEnabled.value) playPresetSound(preset);
        doSaveState();
      });

      api.onLoadCustomSound(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (e: Event) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = evt => {
              customSound.value = (evt.target as FileReader).result as string;
              message.value = '自定义音效已加载！';
              showMessage.value = true;
              setTimeout(() => {
                showMessage.value = false;
              }, 2000);
              // Preview the sound
              if (soundEnabled.value) playCustomSound(customSound.value);
              doSaveState();
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      });
    }

    function cleanupIpcListeners() {
      const channels = [
        'change-skin',
        'load-custom-skin',
        'refresh-state',
        'show-info',
        'save-on-exit',
        'toggle-chime',
        'set-chime-hours',
        'set-chime-message',
        'prompt-chime-hours',
        'prompt-chime-message',
        'start-countdown',
        'cancel-countdown',
        'prompt-countdown',
        'toggle-sound',
        'set-sound-preset',
        'load-custom-sound',
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
      // Sync state to main process for tray menu
      api.notifyChimeState(config.value.clock.enableChime);
      api.notifySoundState(soundEnabled.value);
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
      isHovering,
      isAutoMoving,
      moveDirection,
      petEmoji,
      petImageSrc,
      petClass,
      chatLabel,
      countdownDisplay,
      promptVisible,
      promptTitle,
      promptPlaceholder,
      promptValue,
      promptConfirm,
      promptCancel,
      petClick,
      chatClick,
      petHover,
      handleMouseEnter,
      handleMouseLeave,
      closeApp,
      dragHandleMouseDown,
    };
  },
});

vueApp.mount('#app');
