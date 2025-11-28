<?php

namespace Viezel\FilamentTour\Tour\Traits;

use Filament\Facades\Filament;

trait CanConstructRoute
{
    private array|false|int|null|string $route = null;

    public function getRoute(): array|false|int|null|string
    {
//        $instance = new $class;

        if ($this->route != null) {
            return $this->route;
        }

        if (! Filament::auth()->user()) {
            return '/';
        }

        if (Filament::getCurrentPanel()->getTenantModel()) {

            $tenants = Filament::getCurrentPanel()->getTenantModel()::find(Filament::auth()->user()->getTenants(Filament::getCurrentPanel()));

            $tenant = $tenants->first();

            $slug = $tenant->slug;
            if ($slug) {
                $this->route = parse_url(static::getUrl(['tenant' => $slug]))['path'];
            }
        } else {
            if (method_exists(static::class, 'getResource')) {
                $resource = new (static::getResource());
                foreach ($resource->getPages() as $key => $page) {
                    if (static::class === $page->getPage()) {
                        $this->route = parse_url($resource->getUrl($key))['path'];
                    }
                }
            } else {
                $this->route = parse_url(static::getUrl())['path'] ?? '/';
            }

        }

        return $this->route;
    }

    public function setRoute(string $route)
    {
        $this->route = $route;
    }
}
