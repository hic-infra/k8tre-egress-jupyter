import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import {
  IFileBrowserFactory,
} from '@jupyterlab/filebrowser';
import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { Drag } from '@lumino/dragdrop';
import { fileIcon, folderIcon } from '@jupyterlab/ui-components';
import { requestAPI } from './request';

/**
 * The mime type used by the JupyterLab file browser for dragged file contents.
 * Not exported publicly by @jupyterlab/filebrowser, so we mirror it here.
 */
const CONTENTS_MIME = 'application/x-jupyter-icontents';

/**
 * A content widget that accepts drops from the file browser.
 */
class DropTargetWidget extends Widget {
  private _fileList: HTMLUListElement;
  private _droppedPaths: string[] = [];
  private _sendButton: HTMLButtonElement;
  private _statusLabel: HTMLSpanElement;
  constructor() {
    super();
    this.addClass('jp-DropTarget');

    const placeholder = document.createElement('div');
    placeholder.className = 'jp-DropTarget-placeholder';
    placeholder.textContent = 'Drag a file from the browser here';

    this._fileList = document.createElement('ul');
    this._fileList.className = 'jp-DropTarget-list';

  const footer = document.createElement('div');
  footer.className = 'jp-DropTarget-footer';

  this._sendButton = document.createElement('button');
  this._sendButton.className = 'jp-DropTarget-sendButton';
  this._sendButton.textContent = 'Send files';
  this._sendButton.disabled = true;
  this._sendButton.onclick = () => {
    void this._sendFiles();
  };

  this._statusLabel = document.createElement('span');
  this._statusLabel.className = 'jp-DropTarget-status';

  footer.appendChild(this._sendButton);
  footer.appendChild(this._statusLabel);

  this.node.appendChild(placeholder);
  this.node.appendChild(this._fileList);
  this.node.appendChild(footer);
  }

  private _addFileRow(path: string): void {
    const row = document.createElement('li');
    row.className = 'jp-DropTarget-row';

    const isDir = !path.includes('.') || path.endsWith('/');
    const icon = isDir ? folderIcon : fileIcon;
    const iconNode = icon.element({
      tag: 'span',
      width: '16px',
      height: '16px'
    });
    iconNode.className = 'jp-DropTarget-icon';

    const label = document.createElement('span');
    label.className = 'jp-DropTarget-label';
    label.textContent = path;
    label.title = path;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'jp-DropTarget-remove';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => {
      this._droppedPaths = this._droppedPaths.filter(p => p !== path);
      row.remove();
      if (!this._droppedPaths.length) {
        this.node
          .querySelector('.jp-DropTarget-placeholder')
          ?.setAttribute('style', '');
      }
      this._sendButton.disabled = this._droppedPaths.length === 0;
    };

    row.append(iconNode, label, removeBtn);
    this._fileList.appendChild(row);
  }

  // Attach/detach the Lumino drag-drop listeners with the widget's lifecycle
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('lm-dragenter', this);
    this.node.addEventListener('lm-dragover', this);
    this.node.addEventListener('lm-drop', this);
  }

  protected onBeforeDetach(msg: Message): void {
    this.node.removeEventListener('lm-dragenter', this);
    this.node.removeEventListener('lm-dragover', this);
    this.node.removeEventListener('lm-drop', this);
    super.onBeforeDetach(msg);
  }

  // Lumino widgets dispatch DOM events registered with addEventListener(type, this)
  // to this handleEvent method automatically.
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'lm-dragenter':
      case 'lm-dragover':
        this._evtDragOver(event as Drag.Event);
        break;
      case 'lm-drop':
        this._evtDrop(event as Drag.Event);
        break;
    }
  }

  private _evtDragOver(event: Drag.Event): void {
    if (!event.mimeData.hasData(CONTENTS_MIME)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dropAction = event.proposedAction;
  }

  private _evtDrop(event: Drag.Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.removeClass('jp-mod-active');

    if (event.proposedAction === 'none') {
      event.dropAction = 'none';
      return;
    }

    if (!event.mimeData.hasData(CONTENTS_MIME)) {
      return;
    }

    event.dropAction = event.proposedAction;

    const paths = event.mimeData.getData(CONTENTS_MIME) as string[];

    for (const path of paths) {
      if (!this._droppedPaths.includes(path)) {
        this._droppedPaths.push(path);
        this._addFileRow(path);
      }
    }

    const placeholder = this.node.querySelector(
      '.jp-DropTarget-placeholder'
    ) as HTMLElement | null;
    if (placeholder) {
      placeholder.style.display = this._droppedPaths.length ? 'none' : '';
    }

    this._sendButton.disabled = this._droppedPaths.length === 0;
  }

  private async _sendFiles(): Promise<void> {
  if (!this._droppedPaths.length) {
    return;
  }

  this._sendButton.disabled = true;
  this._statusLabel.textContent = 'Sending…';
  this._statusLabel.className = 'jp-DropTarget-status';

  try {
    const data = await requestAPI<any>('send-files', {
      method: 'POST',
      body: JSON.stringify({ paths: this._droppedPaths })
    });
    console.log(data);
    this._statusLabel.textContent = 'Sent successfully';
    this._statusLabel.classList.add('jp-DropTarget-status-success');
  } catch (error) {
    console.error('Failed to send files:', error);
    this._statusLabel.textContent = 'Failed to send';
    this._statusLabel.classList.add('jp-DropTarget-status-error');
  } finally {
    this._sendButton.disabled = this._droppedPaths.length === 0;
  }
}
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hic-egress-request',
  description: 'An extension to allow users in HIC to request file egress',
  autoStart: true,
  requires: [ICommandPalette, IFileBrowserFactory],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
  ) => {
    const newWidget = () => {
      const content = new DropTargetWidget();
      const widget = new MainAreaWidget({ content });
      widget.id = 'hic-egress-request';
      widget.title.label = 'Files to Egress';
      widget.title.closable = true;
      return widget;
    };
    let widget = newWidget();

    const command: string = 'apod:open';
    app.commands.addCommand(command, {
      label: 'Request Egress',
      execute: () => {
        if (widget.isDisposed) {
          widget = newWidget();
        }
        if (!widget.isAttached) {
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });

    palette.addItem({ command, category: 'Tutorial' });
  }
};

export default plugin;
