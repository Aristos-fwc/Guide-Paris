import { useTransition } from '../transition.jsx';

// A link that plays the cartoon page transition. `label` is the name shown
// under the logo while the screen is covered. Falls back to a plain hash link
// (new tab, middle click, copy address) when modifier keys are used.
export default function TransitionLink({ to, label, className, children, ...rest }) {
  const { go } = useTransition();

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(to, e, label);
  }

  return (
    <a href={'#' + to} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
