/**
 * Keyframes used across the auth pages. Kept as a tiny component so it
 * can be dropped into either page without dragging the keyframes into
 * `globals.css` (which would expose them site-wide).
 */
export default function AuthAnimations() {
  return (
    <style>{`
      @keyframes float {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -18px, 0); }
      }

      @keyframes drift {
        0% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(40px, -30px, 0) scale(1.05); }
        100% { transform: translate3d(0, 0, 0) scale(1); }
      }

      @keyframes meshShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      @keyframes pop {
        0% { transform: scale(0.85); opacity: 0; }
        60% { transform: scale(1.05); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
      }
    `}</style>
  );
}
