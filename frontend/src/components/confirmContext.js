import { createContext, useContext } from 'react';

/**
 * confirm({title, message, content, confirmLabel, cancelLabel, tone}) → Promise<boolean>.
 * Замена window.confirm: то же «да/нет», но в окне интерфейса.
 * tone: 'danger' (необратимое, красное) | 'success' (завершить, бирюзовое) | 'primary'.
 */
export const ConfirmContext = createContext(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}
