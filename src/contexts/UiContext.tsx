import {createContext} from "react";

export const UiContext = createContext<{
  error?: Error;
  progress?: string | boolean;
  setError: (error: Error) => void;
  setProgress: (progress?: string | boolean) => void;
  unsetError: () => void;
  unsetProgress: () => void;
}>({
  setError: () => {},
  setProgress: () => {},
  unsetError: () => {},
  unsetProgress: () => {},
});
