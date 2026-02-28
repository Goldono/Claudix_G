# Dropdown

****Dropdown。

## 🎯

###
- **Dropdown**: ，、/
- **DropdownItem**: ，
- ****: （ChatInputBox）

###
- ✓ （、、）
- ✓ ，
- ✓ 、、
- ✓ TypeScript

## 📋

### DropdownItemData
```typescript
interface DropdownItemData {
 id: string //
 label?: string //
 name?: string //
 detail?: string // （、）
 icon?: string // CSS
 rightIcon?: string // CSS
 checked?: boolean //
 disabled?: boolean //
 type?: string //
 data?: any //
 [key: string]: any //
}
```

## 🔧

###
```vue
<template>
  <Dropdown
    :is-visible="showDropdown"
    :position="dropdownPosition"
    @close="hideDropdown"
  >
    <template #content>
      <DropdownItem
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :index="index"
        @click="handleSelect"
      />
    </template>
  </Dropdown>
</template>
```

###
```vue
<DropdownItem :item="item" :index="index">
  <template #icon="{ item }">
    <FileIcon v-if="item.type === 'file'" :file-name="item.name" />
    <i v-else :class="item.icon"></i>
  </template>
</DropdownItem>
```

###
```typescript
const contextItems: DropdownItemData[] = [
  {
    id: 'file-1',
    label: 'main.ts',
    detail: 'src/main.ts',
    type: 'file',
    data: { path: '/project/src/main.ts' }
  },
  {
    id: 'option-1',
    label: 'Settings',
    icon: 'codicon-settings',
    rightIcon: 'codicon-chevron-right',
    type: 'submenu',
    data: { category: 'settings' }
  }
]
```

## 🏗️

```
Dropdown ()
├── ScrollableElement ()
│ └── (slot)
│ ├── DropdownItem ()
│ ├── DropdownSeparator ()
│ └──
└── Footer ()
```

## 🎨

- CSS
- VSCode
- Monaco
-

## 📝

1. ****: data
2. ****: TypeScript
3. ****: ，
4. ****: slotdata

## 🔄

:

1.
2. `DropdownItemData`
3. `item.type``item.data`
4. slot

Dropdown，。