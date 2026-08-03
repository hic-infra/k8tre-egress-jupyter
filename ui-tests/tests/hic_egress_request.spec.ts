import { expect, test } from '@jupyterlab/galata';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

const DROPZONE = '.jp-DropTarget-placeholder';
const FILE_LIST_ITEM = '.jp-DropTarget-list';
const UPLOAD_BUTTON = '.jp-DropTarget-sendButton';
const SUCCESS_STATUS = '.jp-DropTarget-status';

test.describe('Drag-and-drop file upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto();
    await page.evaluate(async () => {
      await window.jupyterapp.commands.execute('egress-request:open');
    });
  });

  test('accepts a valid file on drop', async ({ page }) => {
    await dropFile(page);

    await expect(page.locator(FILE_LIST_ITEM)).toHaveCount(1);
    await expect(page.locator(FILE_LIST_ITEM)).toContainText('results.csv');
    await expect(page.locator(UPLOAD_BUTTON)).toBeEnabled();
  });

  /*test('accepts multiple files on drop', async ({ page }) => {
    await dropFiles(page, DROPZONE, [
      { name: 'a.csv', mimeType: 'text/csv', content: '1' },
      { name: 'b.csv', mimeType: 'text/csv', content: '2' }
    ]);
 
    await expect(page.locator(FILE_LIST_ITEM)).toHaveCount(2);
  });*/

  test('removes active state after drop', async ({ page }) => {
    const dropzone = page.locator(DROPZONE);

    await dropFile(page);

    await expect(dropzone).not.toHaveAttribute('data-drag-active', 'true');
  });

  test('uploads the file when upload is clicked', async ({ page }) => {
    await dropFile(page);

    await page.locator(UPLOAD_BUTTON).click();

    await expect(page.locator(SUCCESS_STATUS)).toBeVisible();
  });
});

async function dropFile(page) {
  await page.evaluate(async () => {
    await window.jupyterapp.serviceManager.contents.save('/results.csv', {
      type: 'file',
      format: 'text',
      content: 'a,b,c\n1,2,3'
    });
  });

  const fileItem = page.locator('.jp-DirListing-item', {
    hasText: 'results.csv'
  });
  const dropzone = page.locator(DROPZONE);

  const source = await fileItem.boundingBox();
  const target = await dropzone.boundingBox();
  if (!source || !target) {
    throw new Error('Drag source or target not found on page');
  }

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = target.x + target.width / 2;
  const endY = target.y + target.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // small step first to clear Lumino's drag-start distance threshold
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}
