"use client";

import { useState } from "react";
import {
  Building2,
  LayoutGrid,
  Phone,
  UserRound,
  ClipboardPen,
  Send,
  CheckCircle2,
  X,
  Shield,
} from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// export type Interest =
//   | "Pas intéressé"
//   | " Peut-être"
//   | "Veut plus d’informations"
//   | " Intéressé"
//   | "Prêt à discuter";

export type Report = {
  entreprise: string;
  type: string;
  contact: string;
  interest: string;
  agent: string;
  notes: string;
  platform: string;

  date?: string;
  time?: string;
};

const initialState: Report = {
  entreprise: "",
  type: "",
  contact: "",
  interest: "",
  notes: "",
  agent: "",
  platform: "",
};

export default function Report() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<Report>(initialState);
  const [error, setErrors] = useState<Partial<Record<keyof Report, string>>>(
    {},
  );

  //Validate Form input
  const err: Partial<Record<keyof Report, string>> = {};

  const validateForm = (err: Partial<Record<keyof Report, string>>) => {
    if (!data.entreprise.trim() || data.entreprise.length < 5) {
      err.entreprise = "Valide business nom repuis.";
    }
    if (!data.type.trim() || data.type.length < 5) {
      err.type = "Type de business repuis.";
    }
    if (!data.contact.trim() || data.contact.length < 5) {
      err.contact = "Contact du business repuis.";
    }
    if (!data.interest) {
      err.interest = "Nom du business Requis.";
    }
    if (!data.platform) {
      err.interest = "selectionnez une option.";
    }
    if (!data.notes.trim() || data.notes.length < 15) {
      err.notes = "Note sur le business requise.";
    }
    if (!data.agent.trim() || data.agent.length < 5) {
      err.agent = "Nom de l'agent requis.";
    }

    setErrors(err);
    if (Object.keys(err).length !== 0) {
      console.log("Form invalid");
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate Form
    validateForm(err);

    // submit to Supabase
    setLoading(true);
    const { error } = await supabase.from("reports").insert([data]);
    if (error) {
      console.log("Error inserting data:", error);
      return;
    }

    setShowModal(true);

    setTimeout(() => {
      setShowModal(false);
    }, 3000);

    setData(initialState);
    setLoading(false);
  };

  return (
    <section className="min-h-screen bg-[#f5f7fb] px-4 py-16">
      <div className="mx-auto max-w-3xl rounded-4xl bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] border border-slate-100 overflow-hidden">
        {/* HEADER */}
        <div className="px-6 pt-10 pb-6 text-center">
          {/* LOGO */}
          <div className="mb-5 flex justify-center">
            <Image
              src="/images/logo.png"
              alt="Relais"
              width={82}
              height={52}
              className="w-auto object-contain"
            />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-[#0f2557]">
            Nouveau rapport de prospection
          </h1>

          <p className="mt-3 text-lg text-slate-500">
            Remplissez les informations du point de vente visité
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-8 px-6 pb-10 md:px-10">
          {/* BUSINESS NAME */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <Building2 className="h-6 w-6 text-blue-500" />
              1. Nom de l’entreprise
              <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              placeholder="Ex: Restaurant Teranga"
              className="h-16 w-full rounded-2xl border border-slate-200 px-5 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              value={data.entreprise}
              onChange={(e) =>
                setData((prev) => ({ ...prev, entreprise: e.target.value }))
              }
              required
            />
            {error.entreprise && (
              <p className="text-sm text-red-600">{error.entreprise}</p>
            )}
          </div>

          {/* BUSINESS TYPE */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <LayoutGrid className="h-6 w-6 text-green-500" />
              2. Type de business
              <span className="text-red-500">*</span>
            </label>

            <select
              className="h-16 w-full rounded-2xl border border-slate-200 px-5 text-slate-600 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              required
              value={data.type}
              onChange={(e) =>
                setData((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              <option value="">Sélectionnez le type de business</option>
              <option>Restaurant</option>
              <option>Salle de sport</option>
              <option>Salon de coiffure</option>
              <option>Boutique tech</option>
              <option>Bijouterie</option>
              <option>Barbershop</option>
              <option>Autre</option>
            </select>
            {error.type && <p className="text-sm text-red-600">{error.type}</p>}
          </div>

          {/* ONLINE PLATFORM */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <Building2 className="h-6 w-6 text-blue-500" />
              3. Presence Actuelle en ligne
              <span className="text-red-500">*</span>
            </label>

            <select
              className="h-16 w-full rounded-2xl border border-slate-200 px-5 text-slate-600 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              required
              value={data.platform}
              onChange={(e) =>
                setData((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              <option value="">Sélectionnez une option</option>
              <option value="appel">Appel</option>
              <option value="whatsApp">whatsApp</option>
              <option value="socialMedia">Social Media</option>
              <option value="website">Site Internet</option>
              <option value="none">Rien</option>
            </select>
            {error.platform && (
              <p className="text-sm text-red-600">{error.platform}</p>
            )}
          </div>

          {/* CONTACT */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <Phone className="h-6 w-6 text-cyan-500" />
              4. Contact de l’entreprise
              <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              placeholder="Ex: 70 12 34 56 / WhatsApp / Facebook"
              className="h-16 w-full rounded-2xl border border-slate-200 px-5 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              required
              value={data.contact}
              onChange={(e) =>
                setData((prev) => ({ ...prev, contact: e.target.value }))
              }
            />
            {error.contact && (
              <p className="text-sm text-red-600">{error.contact}</p>
            )}
          </div>

          {/* INTEREST */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <UserRound className="h-6 w-6 text-violet-500" />
              5. Niveau d’intérêt
              <span className="text-red-500">*</span>
            </label>

            <select
              className="h-16 w-full rounded-2xl border border-slate-200 px-5 text-slate-600 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              required
              value={data.interest}
              onChange={(e) =>
                setData((prev) => ({ ...prev, intrest: e.target.value }))
              }
            >
              <option value="">Sélectionnez le niveau d’intérêt</option>
              <option>❌ Pas intéressé</option>
              <option>🤔 Peut-être</option>
              <option>👀 Veut plus d’informations</option>
              <option>🔥 Intéressé</option>
              <option>✅ Prêt à discuter</option>
            </select>
            {error.interest && (
              <p className="text-sm text-red-600">{error.interest}</p>
            )}
          </div>

          {/* NOTES */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <ClipboardPen className="h-6 w-6 text-amber-500" />
              6. Notes <span className="text-red-500">*</span>
            </label>

            <textarea
              rows={5}
              placeholder="Informations complémentaires, remarques, rendez-vous prévu..."
              className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              value={data.notes}
              onChange={(e) =>
                setData((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
            {error.notes && (
              <p className="text-sm text-red-600">{error.notes}</p>
            )}
          </div>

          {/* COMMERCIAL */}
          <div>
            <label className="mb-3 flex items-center gap-3 text-xl font-semibold text-slate-800">
              <UserRound className="h-6 w-6 text-teal-500" />
              Nom du commercial
              <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              placeholder="Votre nom..."
              value={data.agent}
              className="h-16 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 outline-none transition focus:border-[#0f2557] focus:ring-4 focus:ring-blue-100"
              onChange={(e) =>
                setData((prev) => ({ ...prev, agent: e.target.value }))
              }
              required
            />
            {error.agent && (
              <p className="text-sm text-red-600">{error.agent}</p>
            )}
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#0f2557] text-xl font-semibold text-white transition hover:opacity-95 active:scale-[0.99]"
            disabled={loading}
          >
            <Send className="h-6 w-6" />
            {loading ? "Envoi..." : "Soumettre le rapport"}
          </button>

          {/* FOOTER */}
          <div className="flex items-center justify-center gap-2 text-center text-sm text-slate-500">
            <Shield className="h-5 w-5" />
            Vos données sont sécurisées et confidentielles.
          </div>
        </form>
      </div>

      {/* SUCCESS MODAL */}
      {showModal && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />

              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  Rapport soumis.
                </h3>

                <p className="mt-1 text-slate-500">Merci !</p>
              </div>
            </div>

            <button onClick={() => setShowModal(false)}>
              <X className="h-6 w-6 text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
