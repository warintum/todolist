import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export const useConfetti = () => {
  const triggerConfetti = useCallback((options?: confetti.Options) => {
    const defaults: confetti.Options = {
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
    };

    confetti({
      ...defaults,
      ...options,
    });
  }, []);

  const triggerSuccess = useCallback(() => {
    // Left burst
    confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#10b981', '#34d399', '#06b6d4'],
    });

    // Right burst
    confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#10b981', '#34d399', '#06b6d4'],
    });
  }, []);

  const triggerCelebration = useCallback(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults, 
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
      });
      confetti({
        ...defaults, 
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return { triggerConfetti, triggerSuccess, triggerCelebration };
};
