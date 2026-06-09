import { useEffect, type ReactElement, type ReactNode } from 'react';

export interface AppThemeBootstrapProps {
  readonly children: ReactNode;
}

function initEditorCssVars(): void {
  try {
    const fontSize = localStorage.getItem('schola.editorFontSize');
    if (fontSize) {
      document.documentElement.style.setProperty('--editor-font-size', fontSize + 'px');
    }
    const lineHeight = localStorage.getItem('schola.editorLineHeight');
    if (lineHeight) {
      document.documentElement.style.setProperty('--editor-line-height', lineHeight);
    }
    const fontFamily = localStorage.getItem('schola.editorFontFamily');
    if (fontFamily) {
      document.documentElement.style.setProperty('--editor-font-family', fontFamily);
    }
  } catch {
    // localStorage unavailable — use CSS defaults
  }
}

export function AppThemeBootstrap({ children }: AppThemeBootstrapProps): ReactElement {
  useEffect(() => {
    initEditorCssVars();
  }, []);
  return <>{children}</>;
}
