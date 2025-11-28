<?php

namespace Viezel\FilamentTour\Tour\Traits;

trait HasTourEvent
{
    /** @var array{name: string, params: array<string, mixed>}|null */
    private ?array $dispatchOnComplete = null;

    /** @var array{name: string, params: array<string, mixed>}|null */
    private ?array $dispatchOnDismiss = null;

    public function dispatchOnComplete(string $name, mixed ...$params): self
    {
        $this->dispatchOnComplete = ['name' => $name, 'params' => $params];

        return $this;
    }

    public function getDispatchOnComplete(): ?array
    {
        return $this->dispatchOnComplete;
    }

    public function dispatchOnDismiss(string $name, mixed ...$params): self
    {
        $this->dispatchOnDismiss = ['name' => $name, 'params' => $params];

        return $this;
    }

    public function getDispatchOnDismiss(): ?array
    {
        return $this->dispatchOnDismiss;
    }
}
