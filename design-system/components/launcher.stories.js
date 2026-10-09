export default {
  title: 'Pendo Act/Launcher',
};

export const Default = {
  render: () => {
    const root = document.createElement('div');
    root.className = 'pact-root';
    const button = document.createElement('button');
    button.className = 'pact-launcher';
    button.type = 'button';
    button.textContent = 'Act';
    root.appendChild(button);
    return root;
  },
};
