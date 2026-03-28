"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Comprehensive list of countries with flags and dial codes
const countries = [
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { code: "LY", name: "Libya", dialCode: "+218", flag: "🇱🇾" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic", dialCode: "+420", flag: "🇨🇿" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦" },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "RO", name: "Romania", dialCode: "+40", flag: "🇷🇴" },
  { code: "BG", name: "Bulgaria", dialCode: "+359", flag: "🇧🇬" },
  { code: "HU", name: "Hungary", dialCode: "+36", flag: "🇭🇺" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "HR", name: "Croatia", dialCode: "+385", flag: "🇭🇷" },
  { code: "SK", name: "Slovakia", dialCode: "+421", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", dialCode: "+386", flag: "🇸🇮" },
  { code: "RS", name: "Serbia", dialCode: "+381", flag: "🇷🇸" },
  { code: "BA", name: "Bosnia and Herzegovina", dialCode: "+387", flag: "🇧🇦" },
  { code: "AL", name: "Albania", dialCode: "+355", flag: "🇦🇱" },
  { code: "MK", name: "North Macedonia", dialCode: "+389", flag: "🇲🇰" },
  { code: "ME", name: "Montenegro", dialCode: "+382", flag: "🇲🇪" },
  { code: "XK", name: "Kosovo", dialCode: "+383", flag: "🇽🇰" },
  { code: "EE", name: "Estonia", dialCode: "+372", flag: "🇪🇪" },
  { code: "LV", name: "Latvia", dialCode: "+371", flag: "🇱🇻" },
  { code: "LT", name: "Lithuania", dialCode: "+370", flag: "🇱🇹" },
  { code: "BY", name: "Belarus", dialCode: "+375", flag: "🇧🇾" },
  { code: "MD", name: "Moldova", dialCode: "+373", flag: "🇲🇩" },
  { code: "GE", name: "Georgia", dialCode: "+995", flag: "🇬🇪" },
  { code: "AM", name: "Armenia", dialCode: "+374", flag: "🇦🇲" },
  { code: "AZ", name: "Azerbaijan", dialCode: "+994", flag: "🇦🇿" },
  { code: "KZ", name: "Kazakhstan", dialCode: "+7", flag: "🇰🇿" },
  { code: "UZ", name: "Uzbekistan", dialCode: "+998", flag: "🇺🇿" },
  { code: "TM", name: "Turkmenistan", dialCode: "+993", flag: "🇹🇲" },
  { code: "TJ", name: "Tajikistan", dialCode: "+992", flag: "🇹🇯" },
  { code: "KG", name: "Kyrgyzstan", dialCode: "+996", flag: "🇰🇬" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭" },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲" },
  { code: "JO", name: "Jordan", dialCode: "+962", flag: "🇯🇴" },
  { code: "LB", name: "Lebanon", dialCode: "+961", flag: "🇱🇧" },
  { code: "SY", name: "Syria", dialCode: "+963", flag: "🇸🇾" },
  { code: "IQ", name: "Iraq", dialCode: "+964", flag: "🇮🇶" },
  { code: "IR", name: "Iran", dialCode: "+98", flag: "🇮🇷" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { code: "PS", name: "Palestine", dialCode: "+970", flag: "🇵🇸" },
  { code: "YE", name: "Yemen", dialCode: "+967", flag: "🇾🇪" },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { code: "DZ", name: "Algeria", dialCode: "+213", flag: "🇩🇿" },
  { code: "TN", name: "Tunisia", dialCode: "+216", flag: "🇹🇳" },
  { code: "SD", name: "Sudan", dialCode: "+249", flag: "🇸🇩" },
  { code: "ET", name: "Ethiopia", dialCode: "+251", flag: "🇪🇹" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺" },
  { code: "DO", name: "Dominican Republic", dialCode: "+1", flag: "🇩🇴" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷" },
  { code: "JM", name: "Jamaica", dialCode: "+1", flag: "🇯🇲" },
  { code: "HT", name: "Haiti", dialCode: "+509", flag: "🇭🇹" },
  { code: "PA", name: "Panama", dialCode: "+507", flag: "🇵🇦" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { code: "TT", name: "Trinidad and Tobago", dialCode: "+1", flag: "🇹🇹" },
  { code: "CY", name: "Cyprus", dialCode: "+357", flag: "🇨🇾" },
  { code: "MT", name: "Malta", dialCode: "+356", flag: "🇲🇹" },
  { code: "IS", name: "Iceland", dialCode: "+354", flag: "🇮🇸" },
  { code: "LU", name: "Luxembourg", dialCode: "+352", flag: "🇱🇺" },
  { code: "MC", name: "Monaco", dialCode: "+377", flag: "🇲🇨" },
  { code: "AD", name: "Andorra", dialCode: "+376", flag: "🇦🇩" },
  { code: "LI", name: "Liechtenstein", dialCode: "+423", flag: "🇱🇮" },
  { code: "SM", name: "San Marino", dialCode: "+378", flag: "🇸🇲" },
  { code: "VA", name: "Vatican City", dialCode: "+379", flag: "🇻🇦" },
].sort((a, b) => a.name.localeCompare(b.name))

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  defaultCountry?: string
  disabled?: boolean
  className?: string
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "Enter phone number",
  defaultCountry = "TR",
  disabled = false,
  className,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedCountry, setSelectedCountry] = React.useState(() => {
    // Try to detect country from existing value
    if (value) {
      const cleanValue = value.replace(/\s/g, "")
      const found = countries.find((c) => cleanValue.startsWith(c.dialCode))
      if (found) return found
    }
    return countries.find((c) => c.code === defaultCountry) || countries[0]
  })
  
  const [phoneNumber, setPhoneNumber] = React.useState(() => {
    // Extract phone number without dial code
    if (value) {
      const cleanValue = value.replace(/\s/g, "")
      const country = countries.find((c) => cleanValue.startsWith(c.dialCode))
      if (country) {
        return cleanValue.slice(country.dialCode.length)
      }
    }
    return value.replace(/^\+\d+\s*/, "").replace(/\s/g, "")
  })

  // Update the full value when country or number changes
  const updateValue = (country: typeof countries[0], number: string) => {
    const cleanNumber = number.replace(/\D/g, "")
    if (cleanNumber) {
      onChange(`${country.dialCode}${cleanNumber}`)
    } else {
      onChange("")
    }
  }

  const handleCountrySelect = (country: typeof countries[0]) => {
    setSelectedCountry(country)
    updateValue(country, phoneNumber)
    setOpen(false)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value.replace(/[^\d\s-]/g, "")
    setPhoneNumber(newNumber)
    updateValue(selectedCountry, newNumber)
  }

  // Format display number with spaces
  const formatDisplayNumber = (num: string) => {
    const clean = num.replace(/\D/g, "")
    if (clean.length <= 3) return clean
    if (clean.length <= 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`
    if (clean.length <= 10) return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 10)} ${clean.slice(10)}`
  }

  return (
    <div className={cn("flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-[110px] justify-between rounded-r-none border-r-0 px-3 font-normal"
          >
            <span className="flex items-center gap-1.5 text-sm">
              <span className="text-base">{selectedCountry.flag}</span>
              <span className="text-muted-foreground">{selectedCountry.dialCode}</span>
            </span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[280px] p-0" 
          align="start"
          style={{ pointerEvents: "auto" }}
        >
          <Command className="overflow-hidden">
            <CommandInput placeholder="Search country..." />
            <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain scroll-smooth">
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countries.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} ${country.dialCode}`}
                    onSelect={() => handleCountrySelect(country)}
                    className="cursor-pointer py-2"
                  >
                    <span className="flex items-center gap-2 flex-1">
                      <span className="text-base">{country.flag}</span>
                      <span className="flex-1 truncate">{country.name}</span>
                      <span className="text-muted-foreground text-sm">{country.dialCode}</span>
                    </span>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        selectedCountry.code === country.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        value={formatDisplayNumber(phoneNumber)}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded-l-none flex-1"
      />
    </div>
  )
}
