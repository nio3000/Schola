/// <reference types="vite/client" />

// Vite ?url import: returns the built asset URL as a string
declare module '*?url' {
  const url: string;
  export default url;
}
