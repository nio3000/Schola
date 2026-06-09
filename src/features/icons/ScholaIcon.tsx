import type { ReactElement } from 'react';
import { SCHOLA_ICON_DEFINITIONS, resolveScholaIconId } from './schola-icons';
import type { ScholaIconId } from './schola-icons';

export interface ScholaIconProps {
  readonly iconId: ScholaIconId;
  readonly size?: 20 | 22;
  readonly className?: string;
  readonly active?: boolean;
}

export function ScholaIcon({
  iconId,
  size = 20,
  className,
  active = false,
}: ScholaIconProps): ReactElement {
  const resolvedIconId = resolveScholaIconId(iconId);
  const definition = SCHOLA_ICON_DEFINITIONS[resolvedIconId];
  const iconClassName = [
    'schola-icon',
    `schola-icon-${resolvedIconId}`,
    active ? 'schola-icon-active' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={iconClassName}
      data-testid={`schola-icon-${resolvedIconId}`}
      width={size}
      height={size}
      viewBox={definition.viewBox}
      aria-hidden="true"
      focusable="false"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {definition.paths}
    </svg>
  );
}
