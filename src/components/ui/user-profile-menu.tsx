'use client';

import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  PopoverFooter,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { User, Settings, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface UserProfileMenuProps {
  initials: string;
  name: string;
  email: string;
  avatarUrl?: string;
  profilePath: string;
  onLogout: () => void;
}

export function UserProfileMenu({
  initials,
  name,
  email,
  avatarUrl,
  profilePath,
  onLogout,
}: UserProfileMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-10 rounded-full p-0 hover:bg-transparent"
        >
          <Avatar className="h-9 w-9">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-foreground text-background text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end" sideOffset={8}>
        <PopoverHeader>
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="bg-foreground text-background text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <PopoverTitle className="truncate">{name}</PopoverTitle>
              <PopoverDescription className="truncate text-xs">
                {email}
              </PopoverDescription>
            </div>
          </div>
        </PopoverHeader>
        <PopoverBody className="space-y-1 px-2 py-1">
          <Link to={profilePath}>
            {({ isActive }) => (
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className="w-full justify-start"
                size="sm"
              >
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </Button>
            )}
          </Link>
          <Link to={profilePath}>
            {({ isActive }) => (
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className="w-full justify-start"
                size="sm"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Button>
            )}
          </Link>
        </PopoverBody>
        <PopoverFooter>
          <Button
            variant="outline"
            className="w-full bg-transparent"
            size="sm"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
