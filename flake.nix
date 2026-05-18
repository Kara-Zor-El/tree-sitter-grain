{
  description = "Grain grammar for tree-sitter";
  inputs = {
    flakelight.url = "github:nix-community/flakelight";
  };
  # This sets up a development environment that provides the necessary tools to work on this project.
  outputs = { flakelight, ... }:
    flakelight ./. ({ lib, ... }: {
      systems = lib.systems.flakeExposed;
      devShell.packages = pkgs: [
        pkgs.python3
        pkgs.nodejs_22
        pkgs.git
      ];
    });
}