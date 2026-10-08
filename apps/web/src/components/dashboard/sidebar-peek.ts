/** Whether the sidebar was opened just by pointing at its icon (a peek) rather than by a click or Ctrl+B (which keep it open). A peek
 *  closes again once a page is chosen; a click keeps the sidebar open. */
let peeking = false;

export const setPeeking = (value: boolean) => {
  peeking = value;
};
export const isPeeking = () => peeking;
