import { useEffect, useState } from 'react';

export function Quote({ quotes }: { quotes: string[] }) {
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (quotes.length < 2) return;
    const id = window.setInterval(() => {
      setFade(true);
      window.setTimeout(() => {
        setI((v) => (v + 1) % quotes.length);
        setFade(false);
      }, 600);
    }, 6500);
    return () => window.clearInterval(id);
  }, [quotes.length]);

  if (!quotes.length) return null;

  return (
    <section className="quote-section">
      <div className="container">
        <div className="quote-mark" aria-hidden="true">
          “
        </div>
        <p className={`quote-text ${fade ? 'fade' : ''}`}>{quotes[Math.min(i, quotes.length - 1)]}</p>
        {quotes.length > 1 && (
          <div className="quote-dots">
            {quotes.map((_, k) => (
              <button
                key={k}
                className="quote-dot"
                aria-current={k === i}
                aria-label={`第 ${k + 1} 句`}
                onClick={() => {
                  setFade(true);
                  window.setTimeout(() => {
                    setI(k);
                    setFade(false);
                  }, 300);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
