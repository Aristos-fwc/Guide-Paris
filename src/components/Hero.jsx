export default function Hero({ lines = ['City Guide', ': Paris'], short = false, children }) {
  return (
    <header className={'hero' + (short ? ' hero--short' : '')}>
      {children && <div className="hero-top">{children}</div>}
      <div className="hero-body">
        <h1 className="hero-title">
          {lines[0]}<br />
          <span>{lines[1]}</span>
        </h1>
      </div>
    </header>
  );
}
