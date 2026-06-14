import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function DELETE(
  request: NextRequest,
    { params }: { params: { id: string } }
    ) {
      const { id } = params;

        // Delete questions first (to avoid foreign key constraint)
          const { error: qErr } = await supabaseAdmin
              .from('mg_questions')
                  .delete()
                      .eq('theme_id', id);

                        if (qErr) {
                            return NextResponse.json({ error: qErr.message }, { status: 500 });
                              }

                                // Delete the theme
                                  const { error: tErr } = await supabaseAdmin
                                      .from('mg_themes')
                                          .delete()
                                              .eq('id', id);

                                                if (tErr) {
                                                    return NextResponse.json({ error: tErr.message }, { status: 500 });
                                                      }

                                                        return NextResponse.json({ success: true });
                                                        }