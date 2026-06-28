import { useState } from 'react';

// Example custom hook
export function useToggle(initialValue: boolean = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = () => setValue(!value);
  return [value, toggle] as const;
}
