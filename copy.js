const dialog = document.querySelector('.detail-dialog');
const detailContent = dialog.querySelector('.detail-content');
const detailStatus = dialog.querySelector('.detail-status');
const toast = document.querySelector('.toast');
let feedbackTimer;

function announce(message, status) {
  clearTimeout(feedbackTimer);
  toast.textContent = '';
  detailStatus.textContent = '';
  status.textContent = message;
  feedbackTimer = setTimeout(() => { status.textContent = ''; }, 2600);
}

function showDetail(card) {
  dialog.querySelector('#detail-title').textContent = card.querySelector('h2').textContent;
  detailContent.replaceChildren(card.querySelector('template').content.cloneNode(true));
  dialog.querySelector('.detail-footer [data-copy]').textContent =
    detailContent.querySelector('.prompt-round') ? '复制全套' : '复制提示词';
  detailStatus.textContent = '';
  dialog.showModal();
  detailContent.scrollTop = 0;
}

async function copyPrompt(button) {
  const card = button.closest('.prompt');
  const scope = card || detailContent;
  const status = card ? toast : detailStatus;
  const body = card ? card.querySelector('template').content : detailContent;
  const round = button.closest('.prompt-round');
  const text = round
    ? round.querySelector('.prompt-body').textContent
    : body.querySelector('[data-full-prompt]').textContent;
  scope.querySelector('.manual-copy')?.remove();

  try {
    await navigator.clipboard.writeText(text);
    announce('已复制提示词', status);
    return;
  } catch {
    // Some browsers restrict the Clipboard API on local pages.
  }

  const field = document.createElement('textarea');
  field.className = 'manual-copy';
  field.readOnly = true;
  field.setAttribute('aria-label', '手动复制提示词');
  field.value = text;
  (round || scope).append(field);
  field.focus();
  field.select();

  if (document.execCommand?.('copy')) {
    field.remove();
    button.focus({ preventScroll: true });
    announce('已复制提示词', status);
  } else {
    announce('可长按正文手动复制', status);
  }
}

document.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-detail]');
  if (detail) showDetail(detail.closest('.prompt'));

  const copy = event.target.closest('[data-copy]');
  if (copy) copyPrompt(copy);

  if (event.target === dialog) dialog.close();
});
