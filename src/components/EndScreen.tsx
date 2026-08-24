import './EndScreen.css';

/**
 * EndScreen — The final screen after the NO→Don't Forgive path.
 * Quiet, respectful, no manipulation.
 */
export function EndScreen() {
  return (
    <div className="end-screen">
      <div className="end-screen__content">
        <p className="end-screen__text">Thank you for being here.</p>
        <div className="end-screen__star" />
      </div>
    </div>
  );
}
