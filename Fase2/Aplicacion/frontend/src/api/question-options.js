// Se permiten huecos finales del formulario, pero nunca se desplazan letras.
export function editableOptions(values) {
  if (!Array.isArray(values) || !values.length) return ['', '', '', '', ''];
  return [...values, ...Array(Math.max(0, 5 - values.length)).fill('')];
}

export function questionOptions(values, correctAnswer) {
  const options = values.map(value => value.trim());
  while (options.length && options.at(-1) === '') options.pop();
  if (options.length < 2 || options.length > 5 || options.some(value => !value)) {
    throw new Error('q_err_options');
  }
  if (!'ABCDE'.slice(0, options.length).split('').includes(correctAnswer)) {
    throw new Error('q_err_correct');
  }
  return options;
}
