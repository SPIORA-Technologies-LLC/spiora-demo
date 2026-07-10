export async function cookies() {
  return {
    get() {
      return undefined;
    },
  };
}

export async function headers() {
  return new Headers();
}
