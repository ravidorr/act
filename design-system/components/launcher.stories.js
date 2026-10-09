export default {
  title: 'Pendo Act/Launcher',
};

export const Default = {
  render: () => {
    const button = document.createElement('button');
    button.className = 'pact-launcher';
    button.type = 'button';
    button.textContent = 'Act';
    return button;
  },
};
