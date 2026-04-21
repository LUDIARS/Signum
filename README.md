# Signum

Signum は画像ファイルのアウトラインを解析して SVG データを生成する
ツールです。`--detail` スライダー（`0.0`〜`1.0`）で、外観だけの
シルエットから内部の模様まで、トレースする粒度をグラデーションで
切り替えられます。

本リポジトリは **最初のマイルストーン** として、画像を読み込んで
SVG として書き出すところまでを実装しています。

## Install

```sh
pip install -e .
```

依存: Python 3.9+, Pillow, numpy。

## CLI

```sh
# 外観のみ（粗いシルエット）
signum input.png -o outline.svg --detail 0.0

# 既定: ほどよく模様もトレース
signum input.png -o mid.svg

# 内部の模様まで細かく
signum input.png -o detailed.svg --detail 1.0
```

主なオプション:

| オプション               | 説明                                     |
| ------------------------ | ---------------------------------------- |
| `--detail`               | 0.0（外観のみ）〜 1.0（模様まで）        |
| `--stroke`               | 線の色（既定: `#000000`）                |
| `--stroke-width`         | 線幅（既定: `1.0`）                      |
| `--background`           | 背景色。未指定なら透明                   |
| `--min-contour-length`   | これより短い輪郭は破棄（既定: `2`）      |

## Python API

```python
from signum import trace, trace_to_file

svg = trace("photo.jpg", detail=0.3)
trace_to_file("photo.jpg", "photo.svg", detail=0.8, background="white")
```

## 仕組み

1. 画像をグレースケールに変換する。
2. `--detail` から輝度のしきい値を複数決める
   （`0.0` なら 1 本、`1.0` なら 8 本）。
3. 各しきい値で二値化したマスクの境界を単位セグメントとして抽出する。
4. セグメントを連結して閉じたポリラインにし、SVG の `<path>` として出力する。

しきい値を増やすほど、より細かな明度差が輪郭として現れるため、
スライダーが「外観だけ」→「模様まで」の連続的な切り替えになります。

## Tests

```sh
pip install pytest
pytest
```
