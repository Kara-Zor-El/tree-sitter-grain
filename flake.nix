{
  description = "Grain grammar for tree-sitter";
  inputs = {
    flakelight.url = "github:nix-community/flakelight";
  };
  outputs = { flakelight, ... }:
    flakelight ./. ({ lib, ... }: {
      systems = lib.systems.flakeExposed;

      devShell.packages = pkgs: with pkgs; [
        nodejs_22
        git
      ];
    });
}
