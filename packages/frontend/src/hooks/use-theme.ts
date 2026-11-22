//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useState, useEffect } from 'react';

function explicitTheme(): boolean | undefined {
  for (const attribute of ['data-theme', 'data-appearance']) {
    const value = document.documentElement.getAttribute(attribute);
    if (value === 'dark') return true;
    if (value === 'light') return false;
  }
  return undefined;
}

/**
 * Follows the system theme unless the app or host explicitly chooses one.
 * A user toggle overrides host appearance for the current document.
 */
export function useAppTheme() {
  const [isDark, setIsDark] = useState(
    () =>
      explicitTheme() ??
      (document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      setIsDark(explicitTheme() ?? systemTheme.matches);
    };
    const observer = new MutationObserver(updateTheme);
    systemTheme.addEventListener('change', updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-appearance'],
    });

    return () => {
      observer.disconnect();
      systemTheme.removeEventListener('change', updateTheme);
    };
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.setAttribute(
      'data-theme',
      next ? 'dark' : 'light'
    );
    setIsDark(next);
  };

  return { isDark, toggleTheme };
}
