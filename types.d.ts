// types.d.ts
declare global {
  const YaGames: {
    init: () => Promise<SDK>;
  };

  interface Window {
    ysdk?: SDK;
  }
}

interface SDK {
  adv: {
    showFullscreenAdv: (options: { callbacks: AdvCallbacks }) => void;
    showRewardedVideo: (options: { callbacks: RewardedVideoCallbacks }) => void;
  };
}

interface AdvCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (error: Error) => void;
  onOffline?: () => void;
}

interface RewardedVideoCallbacks extends AdvCallbacks {
  onRewarded?: () => void;
}

// Это необходимо, чтобы TypeScript считал этот файл модулем
export {};
