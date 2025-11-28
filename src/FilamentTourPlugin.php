<?php

namespace Viezel\FilamentTour;

use Closure;
use Filament\Contracts\Plugin;
use Filament\Panel;
use Filament\Support\Concerns\EvaluatesClosures;
use Filament\View\PanelsRenderHook;
use Illuminate\Support\Facades\Blade;
use Livewire\Component;
use Viezel\FilamentTour\Highlight\HasHighlight;
use Viezel\FilamentTour\Tour\Enums\TourHistoryType;
use Viezel\FilamentTour\Tour\HasTour;

class FilamentTourPlugin implements Plugin
{
    use EvaluatesClosures;

    public Closure | bool $enabled = true;

    private Closure | bool | null $onlyVisibleOnce = null;

    private ?bool $enableCssSelector = null;

    private TourHistoryType $historyType = TourHistoryType::LocalStorage;

    private Closure | bool $autoStart = true;

    public static function make(): static
    {
        return app(static::class)->autoStart(config('filament-tour.auto_start_tours', true));
    }

    public static function get(): static
    {
        /** @var static $plugin */
        $plugin = filament(app(static::class)->getId());

        return $plugin;
    }

    public function getId(): string
    {
        return 'filament-tour';
    }

    public function register(Panel $panel): void
    {
        if (! $this->getEnabled()) {
            return;
        }

        $panel->renderHook(
            PanelsRenderHook::PAGE_START,
            function (): string {
                if (!($route = request()->route())) {
                    return '';
                }

                /** @var Component $controller */
                $controller = $route->controller;
                $tours = $highlights = [];

                if (in_array(HasTour::class, class_uses($controller))) {
                    /** @phpstan-ignore-next-line */
                    $tours = $controller->constructTours();
                }
                if (in_array(HasHighlight::class, class_uses($controller))) {
                    /** @phpstan-ignore-next-line */
                    $highlights = $controller->constructHighlights();
                }

                return Blade::render('<livewire:filament-tour-widget :tours="$tours" :highlights="$highlights"/>', [
                    'tours' => $tours,
                    'highlights' => $highlights,
                ]);
            });
    }

    public function boot(Panel $panel): void {}

    public function onlyVisibleOnce(bool|Closure $onlyVisibleOnce = true): self
    {
            $this->onlyVisibleOnce = $onlyVisibleOnce;

        return $this;
    }

    public function isOnlyVisibleOnce(): ?bool
    {
        return $this->evaluate($this->onlyVisibleOnce);
    }

    // Generate documentation
    public function enableCssSelector(bool|Closure $enableCssSelector = true): self
    {
        if (is_callable($enableCssSelector)) {
            $this->enableCssSelector = $enableCssSelector();
        } elseif (is_bool($enableCssSelector)) {
            $this->enableCssSelector = $enableCssSelector;
        }

        return $this;
    }

    public function isCssSelectorEnabled(): ?bool
    {
        return $this->enableCssSelector;
    }

    public function historyType(TourHistoryType $type): self
    {
        $this->historyType = $type;

        return $this;
    }

    public function getHistoryType(): TourHistoryType
    {
        return $this->historyType;
    }

    public function autoStart(bool|Closure $autoStart = true): self
    {
        $this->autoStart = $autoStart;

        return $this;
    }

    public function getAutoStart(): bool
    {
        return $this->evaluate($this->autoStart);
    }

    public function enabled(Closure | bool $value = true): static
    {
        $this->enabled = $value;

        return $this;
    }

    public function getEnabled(): bool
    {
        return $this->evaluate($this->enabled);
    }
}
