# hic_egress_request

A JupyterLab extension to create egress requests in the K8TRE TRE

This extension is composed of a Python package named `hic_egress_request`
for the server extension and a NPM package named `hic-egress-request`
for the frontend extension.

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install hic_egress_request
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall hic_egress_request
```

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

## Contributing

If you would like to contribute to this extension, please refer to the [Contributing Guide](CONTRIBUTING.md).
