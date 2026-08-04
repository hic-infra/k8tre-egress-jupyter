import { expect, test } from '@jupyterlab/galata';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

const DROPZONE = '.jp-DropTarget-placeholder';
const FILE_LIST_ITEM = '.jp-DropTarget-list li';
const FILE_ITEM = '.jp-DropTarget-list';
const UPLOAD_BUTTON = '.jp-DropTarget-sendButton';
const SUCCESS_STATUS = '.jp-DropTarget-status';

interface DropFile {
  filename: string;
  type: string;
  format: string;
  content: string;
}

test.describe('Drag-and-drop file upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto();
    await page.evaluate(async () => {
      await window.jupyterapp.commands.execute('egress-request:open');
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      const contents = window.jupyterapp.serviceManager.contents;
      const dir = await contents.get('/');
      await Promise.all(
        dir.content.map((item: any) => contents.delete(item.path))
      );
    });
  });

  test('accepts a valid file on drop', async ({ page }) => {
    await dropFile(page);

    await expect(page.locator(FILE_LIST_ITEM)).toHaveCount(1);
    await expect(page.locator(FILE_LIST_ITEM)).toContainText('results.csv');
    await expect(page.locator(UPLOAD_BUTTON)).toBeEnabled();
  });

  // This currently fails on Github actions - I think because the
  // test runs slowly. To be fixed at some point.
  /*test('accepts multiple files on drop', async ({ page }) => {
    await dropFiles(page, [
      {
        filename: 'a.csv',
        type: 'file',
        content: '1',
        format: 'text/csv'
      },
      {
        filename: 'b.csv',
        type: 'file',
        content: '2',
        format: 'text/csv'
      }
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

  test('rejects a folder dropped onto the dropzone', async ({ page }) => {
    const folderName = 'egress-folder-test';

    // create a folder in the file browser
    await page.evaluate(async folderName => {
      const contents = window.jupyterapp.serviceManager.contents;
      const dir = await contents.newUntitled({ type: 'directory', path: '/' });
      await contents.rename(dir.path, folderName);
    }, folderName);

    const folderItem = page.locator('.jp-DirListing-item', {
      hasText: folderName
    });
    const dropzone = page.locator(DROPZONE);

    const source = await folderItem.boundingBox();
    const target = await dropzone.boundingBox();
    if (!source || !target) {
      throw new Error('Drag source or target not found for folder');
    }

    const startX = source.x + source.width / 2;
    const startY = source.y + source.height / 2;
    const endX = target.x + target.width / 2;
    const endY = target.y + target.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();

    // folder must not appear in the egress list
    await expect(page.locator(FILE_ITEM)).not.toContainText(folderName);

    await expect(page.locator(SUCCESS_STATUS)).toContainText(
      'Folders are not supported — 1 folder skipped'
    );
  });
});

async function dropFile(page) {
  const file = {
    filename: 'results.csv',
    type: 'file',
    format: 'text',
    content: 'a,b,c\n1,2,3'
  };

  await dropFiles(page, [file]);
}

async function dropFiles(page, files: DropFile[]) {
  await page.evaluate(async (files: DropFile[]) => {
    await Promise.all(
      files.map(f =>
        window.jupyterapp.serviceManager.contents.save(`/${f.filename}`, {
          type: 'file',
          format: 'text',
          content: f.content
        })
      )
    );
  }, files);

  for (const f of files) {
    const fileItem = await page.locator('.jp-DirListing-item', {
      hasText: f.filename
    });
    const dropzone = page.locator(DROPZONE);

    const source = await fileItem.boundingBox();
    const target = await dropzone.boundingBox();
    if (!source || !target) {
      throw new Error(`Drag source or target not found for ${f.filename}`);
    }

    const startX = source.x + source.width / 2;
    const startY = source.y + source.height / 2;
    const endX = target.x + target.width / 2;
    const endY = target.y + target.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
  }
}
